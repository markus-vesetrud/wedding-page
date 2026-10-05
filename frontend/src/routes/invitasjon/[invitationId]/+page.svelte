<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { page } from '$app/state';
  import { Attendance, type Guest, type Invitation, type WsDeltaUpdate } from '$shared/types';
  import WelcomeHero from '$lib/components/sections/welcome-hero.svelte';
  import * as Card from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
	import Gift from '$lib/components/ui/icon/gift.svelte';
	import Forward from '$lib/components/ui/icon/forward.svelte';
	import Download from '$lib/components/ui/icon/download.svelte';

  type Member = {
    id: string;
    name: string;
    attendance: Attendance;
    notes: string;
  };

  const notesAutosaveDelayMs = 2000;

  const invitationId = $derived(decodeURIComponent(page.params.invitationId ?? ''));
  const mainMenuHref = $derived(`/?invitationId=${encodeURIComponent(invitationId)}`);
  const pdfDownloadHref = $derived(`/api/invitations/${invitationId}/pdf`)
  const answerDeadlineLabel = '1. februar 2027';

  let loading = $state(true);
  let notFound = $state(false);
  let invitation = $state<Invitation | null>(null);
  let members = $state<Member[]>([]);
  let plusOneEnabled = $state(false);
  let plusOneName = $state('');
  let plusOneNotes = $state('');
  let savedPlusOneKey = '';
  let savingPlusOne = false;
  let plusOneAutosaveTimer: ReturnType<typeof setTimeout> | null = null;
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
      return 'border-input bg-background text-muted-foreground hover:border-accent';
    }
    return 'border-accent bg-muted text-foreground font-semibold';
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

  function plusOneKey(): string {
    return JSON.stringify({ attending: plusOneEnabled, name: plusOneName.trim(), allergies: plusOneNotes });
  }

  function hydratePlusOne(plusOne: Guest | null) {
    plusOneEnabled = plusOne?.attendance === Attendance.Attending;
    plusOneName = plusOne?.name ?? '';
    plusOneNotes = plusOne?.allergies ?? '';
    savedPlusOneKey = plusOneKey();
  }

  function clearPlusOneAutosave() {
    if (!plusOneAutosaveTimer) return;
    clearTimeout(plusOneAutosaveTimer);
    plusOneAutosaveTimer = null;
  }

  function schedulePlusOneAutosave() {
    clearPlusOneAutosave();
    plusOneAutosaveTimer = setTimeout(() => {
      plusOneAutosaveTimer = null;
      void savePlusOne();
    }, notesAutosaveDelayMs);
  }

  function togglePlusOne() {
    plusOneEnabled = !plusOneEnabled;
    void savePlusOne();
  }

  async function savePlusOne() {
    clearPlusOneAutosave();
    // Nothing to save until the plus-one has a name
    if (plusOneEnabled && !plusOneName.trim()) return;
    const key = plusOneKey();
    if (savingPlusOne || key === savedPlusOneKey) return;

    error = '';
    savingPlusOne = true;
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(invitationId)}/plus-one`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: key
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      savedPlusOneKey = key;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Kunne ikke lagre følget.';
      return;
    } finally {
      savingPlusOne = false;
    }
    // The answer may have changed while the request was in flight
    if (plusOneKey() !== savedPlusOneKey) await savePlusOne();
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

      const payload = (await res.json()) as {
        invitation: Invitation;
        guests: Guest[];
        plusOne: Guest | null;
      };
      invitation = payload.invitation;
      hydrateMembers(payload.guests);
      hydratePlusOne(payload.plusOne);
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
    await Promise.all([...members.map((member) => submitNotes(member.id, member.notes)), savePlusOne()]);
    if (invitation?.plusOneText && plusOneEnabled && !plusOneName.trim()) {
      error = 'Skriv inn navnet på følget ditt.';
    }
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
    clearPlusOneAutosave();
    if (savedRecentlyTimer) clearTimeout(savedRecentlyTimer);
  });
</script>

<div class="mx-auto w-full max-w-2xl space-y-6 pb-20 px-4 md:px-6">
  <WelcomeHero photo="canaria" dark />

  {#if loading}
    <Card.Root>
      <Card.Content class="py-8 text-center text-sm text-muted-foreground">Laster invitasjon ...</Card.Content>
    </Card.Root>
  {:else if notFound}
    <Card.Root>
      <Card.Header>
        <Card.Title>Invitasjon ikke funnet</Card.Title>
        <Card.Description>Denne invitasjonslenken finnes desverre ikke, klag til Markus om du tror det er en feil :D <br/> Du kan uansett gå til hovedsiden under</Card.Description>
      </Card.Header>
    </Card.Root>
  {:else if invitation}
    <Card.Root>
      <Card.Header>
        <Card.Title class="text-2xl min-[600px]:text-3xl">Kjære {invitation.name}</Card.Title>
        <Card.Description class="text-md">
          Vi har gleden av å invitere {members.length > 1 ? "dere" : "deg"} til bryllupet vårt! 
          Her kan {members.length > 1 ? "dere" : "du"} svare på om {members.length > 1 ? "dere" : "du"} kommer, helst innen <strong>{answerDeadlineLabel}</strong>. 
          På bryllupssiden finner {members.length > 1 ? "dere" : "du"} program for dagen, veibeskrivelse, gaveønsker og alt det praktiske
        </Card.Description>
      </Card.Header>
    </Card.Root>

    <a
      href={mainMenuHref}
      class="flex items-center gap-4 rounded-xl bg-primary p-5 text-primary-foreground transition-colors hover:bg-accent"
    >
      <span class="flex h-8 w-8 shrink-0 items-center justify-center">
        <Gift color="currentColor"/>
      </span>
      <span class="flex-1">
        <span class="block text-lg font-semibold leading-tight">Se bryllupssiden</span>
        <span class="block text-sm font-medium opacity-90">Program, sted, gaver og kaker</span>
      </span>
      <span class="shrink-0"><Forward color="currentColor" size={30}/></span>
    </a>

    <Card.Root>
      <Card.Header>
        <Card.Title>Svar på invitasjonen</Card.Title>
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
                      class={`min-h-11 flex-1 basis-28 rounded-lg border-2 px-3 py-2 text-sm transition-colors ${pillClasses(option, member.attendance === option)}`}
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

          {#if invitation.plusOneText}
            <div class="mt-5 border-t pt-5">
              <div class="flex items-center justify-between gap-4">
                <p id="plusOneLabel" class="text-lg font-semibold">{invitation.plusOneText}</p>
                <div class="flex shrink-0 items-center gap-2">
                  <span class="text-sm text-muted-foreground">{plusOneEnabled ? 'Ja' : 'Nei'}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={plusOneEnabled}
                    aria-labelledby="plusOneLabel"
                    onclick={togglePlusOne}
                    class={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${plusOneEnabled ? 'border-accent bg-accent' : 'border-input bg-muted'}`}
                  >
                    <span
                      class={`inline-block h-5 w-5 rounded-full bg-background shadow transition-transform ${plusOneEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                    ></span>
                  </button>
                </div>
              </div>

              {#if plusOneEnabled}
                <div transition:slide={{ duration: 200 }} class="space-y-2 pt-3">
                  <Input
                    type="text"
                    value={plusOneName}
                    oninput={(e: Event) => {
                      plusOneName = (e.currentTarget as HTMLInputElement).value;
                      schedulePlusOneAutosave();
                    }}
                    onblur={savePlusOne}
                    placeholder="Navn på følget"
                    aria-label="Navn på følget"
                  />
                  <Input
                    type="text"
                    value={plusOneNotes}
                    oninput={(e: Event) => {
                      plusOneNotes = (e.currentTarget as HTMLInputElement).value;
                      schedulePlusOneAutosave();
                    }}
                    onblur={savePlusOne}
                    placeholder="Allergier eller andre notater (valgfritt)"
                    aria-label="Allergier eller andre notater for følget"
                  />
                </div>
              {/if}
            </div>
          {/if}

          <button
            type="button"
            onclick={saveAll}
            disabled={saving}
            class="mt-5 min-h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-colors disabled:opacity-60 hover:bg-accent"
          >
            {saving ? 'Lagrer ...' : members.length > 1 ? "Lagre svaret vårt" : "Lagre svaret mitt"}
          </button>

          {#if savedRecently}
            <p class="mt-3 text-center text-sm font-semibold text-foreground">
              ✓ Takk! Svaret {members.length > 1 ? "deres" : "ditt"} er lagret.
            </p>
          {/if}
        {/if}

        {#if error}
          <p class="pt-3 text-sm text-red-600">{error}</p>
        {/if}
      </Card.Content>
    </Card.Root>

    <div class="flex flex-wrap items-center gap-4 rounded-xl border bg-muted p-5">
      <div class="flex-1" style="min-width: 200px;">
        <p class="text-lg font-semibold">Vil dere ha invitasjonen på papir?</p>
        <p class="text-muted-foreground text-sm leading-snug">Last ned og skriv ut i A5, til kjøleskapet eller oppslagstavla.</p>
      </div>
      <a
        href={pdfDownloadHref}
        type="button"
        class="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <Download size={24} /><span>Last ned PDF</span>
    </a>
    </div>

    <a
      href={mainMenuHref}
      class="flex items-center justify-center gap-2 py-3 text-base font-medium text-foreground transition-colors hover:text-accent"
    >
      <span>Se bryllupssiden</span><Forward size={16} color="#7a6a43"/>
    </a>

    <p class="pb-4 text-center font-serif text-xl italic text-muted-foreground">
      Vi gleder oss til å se dere
    </p>
  {/if}
</div>