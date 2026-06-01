<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { page } from '$app/state';
  import { Attendance, type Guest, type Invitation, type WsDeltaUpdate } from '$shared/types';
  import * as Card from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';

  type Member = {
    id: string;
    name: string;
    attendance: Attendance;
    notes: string;
  };

  const notesAutosaveDelayMs = 2000;

  const invitationId = $derived(decodeURIComponent(page.params.invitationId ?? ''));
  const weddingDateLabel = 'Lørdag 31. juli 2027';

  let loading = $state(true);
  let notFound = $state(false);
  let invitation = $state<Invitation | null>(null);
  let members = $state<Member[]>([]);
  let error = $state('');
  const notesAutosaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

  onMount(() => {
    loadInvitation();
  });

  onDestroy(() => {
    for (const timer of notesAutosaveTimers.values()) {
      clearTimeout(timer);
    }
    notesAutosaveTimers.clear();
  });
</script>

<div class="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 md:px-6 lg:py-12">
  {#if loading}
    <Card.Root>
      <Card.Content class="py-8 text-center text-sm text-muted-foreground">Laster invitasjon ...</Card.Content>
    </Card.Root>
  {:else if notFound}
    <Card.Root>
      <Card.Header>
        <Card.Title>Invitasjon ikke funnet</Card.Title>
        <Card.Description>Denne invitasjonslenken finnes ikke.</Card.Description>
      </Card.Header>
    </Card.Root>
  {:else if invitation}
    <Card.Root class="overflow-hidden">
      <img
        src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=80"
        alt="Brudepar"
        class="h-72 w-full object-cover md:h-96"
      />
      <Card.Header>
        <Card.Title class="text-3xl">Velkommen, {invitation.name}</Card.Title>
        <Card.Description>
          Dere er invitert til bryllupet vårt {weddingDateLabel}. Under finner dere alle i invitasjonen og kan svare på om dere kommer.
        </Card.Description>
      </Card.Header>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>Svar på invitasjonen</Card.Title>
      </Card.Header>
      <Card.Content>
        {#if members.length === 0}
          <p class="text-sm text-muted-foreground">Det er ingen gjester koblet til denne invitasjonen ennå.</p>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr class="border-b text-left">
                  <th class="px-3 py-2 font-medium">Navn</th>
                  <th class="px-3 py-2 font-medium">Kommer</th>
                  <th class="px-3 py-2 font-medium">Kommer ikke</th>
                  <th class="px-3 py-2 font-medium">Allergier / notater</th>
                </tr>
              </thead>
              <tbody>
                {#each members as member (member.id)}
                  <tr class="border-b align-top">
                    <td class="px-3 py-3 font-medium">{member.name}</td>
                    <td class="px-3 py-3">
                      <label class="inline-flex items-center justify-center">
                        <input
                          type="radio"
                          name={`attendance-${member.id}`}
                          checked={member.attendance === Attendance.Attending}
                          onchange={() => setAttendance(member.id, Attendance.Attending)}
                          class="h-4 w-4 rounded-full border"
                        />
                      </label>
                    </td>
                    <td class="px-3 py-3">
                      <label class="inline-flex items-center justify-center">
                        <input
                          type="radio"
                          name={`attendance-${member.id}`}
                          checked={member.attendance === Attendance.NotAttending}
                          onchange={() => setAttendance(member.id, Attendance.NotAttending)}
                          class="h-4 w-4 rounded-full border"
                        />
                      </label>
                    </td>
                    <td class="px-3 py-3">
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
                        placeholder="Allergier eller andre notater"
                      />
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        {#if error}
          <p class="pt-3 text-sm text-red-600">{error}</p>
        {/if}
      </Card.Content>
    </Card.Root>
  {/if}
</div>