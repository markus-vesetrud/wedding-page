<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { page } from '$app/state';
  import { Attendance, type Guest, type Invitation, type WsDeltaUpdate } from '$shared/types';
  import WelcomeHero from '$lib/components/sections/welcome-hero.svelte';
  import * as Card from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
	import Gift from '$lib/components/ui/icon/gift.svelte';
	import Forward from '$lib/components/ui/icon/forward.svelte';

  type Member = {
    id: string;
    name: string;
    attendance: Attendance;
    notes: string;
  };

  const notesAutosaveDelayMs = 2000;

  const invitationId = $derived(decodeURIComponent(page.params.invitationId ?? ''));
  const mainMenuHref = $derived(`/?invitationId=${encodeURIComponent(invitationId)}`);
  const weddingDateLabel = 'Lørdag 31. juli 2027, kl. 14:00';
  const answerDeadlineLabel = '1. februar 2027';

  let loading = $state(true);
  let notFound = $state(false);
  let invitation = $state<Invitation | null>(null);
  let members = $state<Member[]>([]);
  let error = $state('');
  let saving = $state(false);
  let savedRecently = $state(false);
  let savedRecentlyTimer: ReturnType<typeof setTimeout> | null = null;
  const notesAutosaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const attendanceOptions: Attendance[] = [
    Attendance.NotAnswered,
    Attendance.NotAttending,
    Attendance.Attending
  ];

  function pillClasses(value: Attendance, active: boolean): string {
    if (!active) {
      return 'border-input bg-background text-foreground hover:bg-muted';
    }
    if (value === Attendance.Attending) {
      return 'border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100';
    }
    if (value === Attendance.NotAttending) {
      return 'border-red-600 bg-red-50 text-red-800 hover:bg-red-100';
    }
    return 'bg-foreground text-background hover:bg-muted-foreground';
  }

  function upsertMember(memberId: string, updater: (member: Member) => Member) {
    members = members.map((member) => (member.id === memberId ? updater(member) : member));
  }

  async function callListEndpoint(payload: Record<string, unknown>): Promise<WsDeltaUpdate | null> {
    try {
      const res = await fetch('/api/update/guests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const json = (await res.json()) as { update?: WsDeltaUpdate };
      return json.update ?? null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Kunne ikke oppdatere gjesteliste.';
      return null;
    }
  }

  function hydrateMembers(guests: Guest[]) {
    members = guests.map((guest) => ({
      id: guest.id,
      name: guest.name,
      attendance: guest.attendance,
      notes: guest.allergies ?? ''
    }));
  }

  async function loadInvitation() {
    loading = true;
    notFound = false;
    error = '';

    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(invitationId)}`);
      if (res.status === 404) {
        notFound = true;
        invitation = null;
        members = [];
        return;
    }

      if (!res.ok) {
        throw new Error(`Kunne ikke laste invitasjon (${res.status})`);
      }

      const payload = (await res.json()) as { invitation: Invitation; guests: Guest[] };
      invitation = payload.invitation;
      hydrateMembers(payload.guests);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Kunne ikke laste invitasjonen.';
    } finally {
      loading = false;
    }
  }

  async function setAttendance(memberId: string, attendance: Attendance) {
    error = '';
    upsertMember(memberId, (current) => ({ ...current, attendance }));

    const update = await callListEndpoint({
      id: memberId,
      patch: { attendance }
    });

    if (update?.list === 'guests') {
      const guest = update.item as Guest;
      upsertMember(memberId, (current) => ({
        ...current,
        attendance: guest.attendance,
        notes: guest.allergies ?? current.notes
      }));
    }
  }

  function updateNotes(memberId: string, value: string) {
    upsertMember(memberId, (current) => ({ ...current, notes: value }));
  }

  function clearNotesAutosave(memberId: string) {
    const timer = notesAutosaveTimers.get(memberId);
    if (!timer) return;
    clearTimeout(timer);
    notesAutosaveTimers.delete(memberId);
  }

  function scheduleNotesAutosave(memberId: string, value: string) {
    clearNotesAutosave(memberId);
    const timer = setTimeout(() => {
      notesAutosaveTimers.delete(memberId);
      void submitNotes(memberId, value);
    }, notesAutosaveDelayMs);
    notesAutosaveTimers.set(memberId, timer);
  }

  async function submitNotes(memberId: string, value: string) {
    error = '';
    const update = await callListEndpoint({
      id: memberId,
      patch: {
        allergies: value
      }
    });

    if (update?.list === 'guests') {
      const guest = update.item as Guest;
      upsertMember(memberId, (current) => ({
        ...current,
        attendance: guest.attendance,
        notes: guest.allergies ?? ''
      }));
    }
  }

  const minSavingIndicatorMs = 300;

  async function saveAll() {
    error = '';
    saving = true;
    const startedAt = Date.now();

    // Clears autosave timers (new ones are scheduled on subsequent changes)
    for (const memberId of [...notesAutosaveTimers.keys()]) {
      clearNotesAutosave(memberId);
    }
    // Save all notes at immidiatly
    await Promise.all(members.map((member) => submitNotes(member.id, member.notes)));
    // Not saving attendance, as any changes there are already saved

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs < minSavingIndicatorMs) {
      await new Promise((resolve) => setTimeout(resolve, minSavingIndicatorMs - elapsedMs));
    }

    saving = false;
    savedRecently = true;
    if (savedRecentlyTimer) clearTimeout(savedRecentlyTimer);
    savedRecentlyTimer = setTimeout(() => {
      savedRecently = false;
    }, 3000);
  }

  onMount(() => {
    loadInvitation();
  });

  onDestroy(() => {
    for (const timer of notesAutosaveTimers.values()) {
      clearTimeout(timer);
    }
    notesAutosaveTimers.clear();
    if (savedRecentlyTimer) clearTimeout(savedRecentlyTimer);
  });
</script>

<div class="mx-auto w-full max-w-2xl space-y-6 pb-20 px-4 md:px-6">
  <WelcomeHero showCountDown />

  {#if loading}
    <Card.Root>
      <Card.Content class="py-8 text-center text-sm text-muted-foreground">Laster invitasjon ...</Card.Content>
    </Card.Root>
  {:else if notFound}
    <Card.Root>
      <Card.Header>
        <Card.Title>Invitasjon ikke funnet</Card.Title>
        <Card.Description>Denne invitasjonslenken finnes desverre ikke, klag til Markus for å få svar om du tror det er en feil :D <br/> Du kan uansett gå til hovedsiden under</Card.Description>
      </Card.Header>
    </Card.Root>
  {:else if invitation}
    <Card.Root>
      <Card.Header>
        <Card.Title class="text-3xl">Velkommen, {invitation.name}</Card.Title>
        <Card.Description>
          {members.length > 1 ? "Dere" : "Du"} er hjertelig invitert til bryllupet vårt {weddingDateLabel}. Gi oss beskjed under om {members.length > 1 ? "dere" : "du"} kommer - gjerne innen <strong>{answerDeadlineLabel}</strong>.
        </Card.Description>
      </Card.Header>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>Svar på invitasjonen</Card.Title>
        <Card.Description>Velg for hver person, og noter eventuelle allergier eller ønsker.</Card.Description>
      </Card.Header>
      <Card.Content>
        {#if members.length === 0}
          <p class="text-sm text-muted-foreground">Det er ingen gjester koblet til denne invitasjonen ennå.</p>
        {:else}
          <div class="divide-y">
            {#each members as member (member.id)}
              <div class="py-5 first:pt-0 last:pb-0">
                <p class="mb-3 text-lg font-semibold">{member.name}</p>

                <div class="mb-3 flex flex-wrap gap-2">
                  {#each attendanceOptions as option (option)}
                    <button
                      type="button"
                      onclick={() => setAttendance(member.id, option)}
                      class={`min-h-11 flex-1 basis-28 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-colors ${pillClasses(option, member.attendance === option)}`}
                    >
                      {option}
                    </button>
                  {/each}
                </div>

                <Input
                  type="text"
                  value={member.notes}
                  oninput={(e: Event) => {
                    const value = (e.currentTarget as HTMLInputElement).value;
                    updateNotes(member.id, value);
                    scheduleNotesAutosave(member.id, value);
                  }}
                  onblur={(e: Event) => {
                    const value = (e.currentTarget as HTMLInputElement).value;
                    clearNotesAutosave(member.id);
                    submitNotes(member.id, value);
                  }}
                  placeholder="Allergier eller andre notater (valgfritt)"
                />
              </div>
            {/each}
          </div>

          <button
            type="button"
            onclick={saveAll}
            disabled={saving}
            class="mt-5 min-h-12 w-full rounded-xl bg-foreground text-base font-bold text-background transition-opacity disabled:opacity-60 hover:bg-muted-foreground"
          >
            {saving ? 'Lagrer ...' : members.length > 1 ? "Lagre svaret vårt" : "Lagre svaret mitt"}
          </button>

          {#if savedRecently}
            <p class="mt-3 text-center text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              ✓ Takk! Svaret {members.length > 1 ? "deres" : "ditt"} er lagret.
            </p>
          {/if}
        {/if}

        {#if error}
          <p class="pt-3 text-sm text-red-600">{error}</p>
        {/if}
      </Card.Content>
    </Card.Root>

    {/if}
    <a
      href={mainMenuHref}
      class="flex items-center gap-4 rounded-xl bg-gradient-to-br from-rose-700 to-rose-800 p-5 text-white shadow-lg shadow-rose-950/20 transition-transform hover:scale-[1.01]"
      style="background:linear-gradient(150deg,#a44371,#833459);"
    >
      <span class="flex h-8 w-8 shrink-0 items-center justify-center">
        <Gift/>
      </span>
      <span class="flex-1">
        <span class="block text-lg font-bold leading-tight">Program, sted og gaver</span>
        <span class="block text-sm font-medium opacity-90">Alt det praktiske for dagen</span>
      </span>
      <span class="shrink-0 text-2xl font-bold"><Forward size={30}/></span>
    </a>
</div>