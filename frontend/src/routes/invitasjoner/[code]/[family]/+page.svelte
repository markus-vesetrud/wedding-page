<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { createWebSocket } from '$lib/websocket';
  import type { AppState, Guest, WsDeltaMessage } from '$lib/types';
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';

  type Member = {
    id: string;
    name: string;
    attending: boolean;
    notes: string;
  };

  const familyName = $derived(decodeURIComponent(page.params.family ?? '').replace(/-/g, ' '));
  const inviteCode = $derived((page.params.code ?? '').toUpperCase());

  let connected = $state(false);
  let guests = $state<Guest[]>([]);
  let members = $state<Member[]>([]);
  let newMemberName = $state('');
  let error = $state('');
  let success = $state('');

  let ws: ReturnType<typeof createWebSocket> | null = null;

  function upsertGuest(list: Guest[], item: Guest): Guest[] {
    const index = list.findIndex((guest) => guest.id === item.id);
    if (index === -1) return [...list, item];
    const copy = [...list];
    copy[index] = item;
    return copy;
  }

  function applyDelta(update: WsDeltaMessage) {
    if (update.list !== 'guests') return;
    guests = upsertGuest(guests, update.item as Guest);
  }

  async function callListEndpoint(
    action: 'add' | 'checked' | 'unchecked',
    payload: Record<string, unknown>
  ): Promise<WsDeltaMessage | null> {
    try {
      const res = await fetch(`/api/lists/guests/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const json = (await res.json()) as { update?: WsDeltaMessage };
      return json.update ?? null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Kunne ikke oppdatere gjesteliste.';
      return null;
    }
  }

  function ensureMember(id: string, name: string, attending = true, notes = '') {
    const existing = members.find((member) => member.id === id);
    if (existing) return;
    members = [...members, { id, name, attending, notes }];
  }

  async function addMember() {
    error = '';
    success = '';

    const name = newMemberName.trim();
    if (!name) return;

    const update = await callListEndpoint('add', { name });
    if (update && update.list === 'guests') {
      const guest = update.item as Guest;
      ensureMember(guest.id, guest.name, true, guest.allergies ?? '');
      newMemberName = '';
    }
  }

  function updateMember(memberId: string, updater: (member: Member) => Member) {
    members = members.map((member) => (member.id === memberId ? updater(member) : member));
  }

  async function submitRsvp() {
    error = '';
    success = '';

    for (const member of members) {
      if (member.attending) {
        const update = await callListEndpoint('checked', {
          id: member.id,
          allergies: member.notes.trim() || 'Ingen notater'
        });
        if (update) applyDelta(update);
      } else {
        const update = await callListEndpoint('unchecked', { id: member.id });
        if (update) applyDelta(update);
      }
    }

    success = 'Takk! Invitasjonssvar er lagret.';
  }

  function hydrateMembersFromGuests(state: AppState) {
    guests = state.guests ?? [];
    for (const guest of guests) {
      ensureMember(guest.id, guest.name, guest.checked, guest.allergies ?? '');
    }
  }

  onMount(() => {
    ws = createWebSocket({
      onState: (state: AppState) => {
        hydrateMembersFromGuests(state);
        connected = true;
      },
      onDelta: (update: WsDeltaMessage) => {
        applyDelta(update);
      }
    });

    return () => {
      ws?.close();
    };
  });

  onDestroy(() => {
    ws?.close();
  });
</script>

<div class="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 md:px-6 lg:py-12">
  <Card.Root class="overflow-hidden">
    <img
      src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=80"
      alt="Brudepar"
      class="h-72 w-full object-cover md:h-96"
    />
    <Card.Header>
      <Card.Title class="text-3xl">Velkommen, {familyName}</Card.Title>
      <Card.Description>
        Invitasjon {inviteCode}. Vi gleder oss til å feire sammen med dere — svar gjerne på hvem som kommer, og legg inn notater (allergier, behov, osv.).
      </Card.Description>
    </Card.Header>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title>Svar på invitasjonen</Card.Title>
      <Card.Description>{connected ? 'Tilkoblet' : 'Kobler til ...'}</Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      {#if members.length === 0}
        <p class="text-muted-foreground text-sm">Legg til familiemedlemmer nedenfor for å svare på invitasjonen.</p>
      {/if}

      <ul class="space-y-3">
        {#each members as member (member.id)}
          <li class="space-y-3 rounded-lg border p-4">
            <div class="flex items-center justify-between gap-4">
              <p class="font-medium">{member.name}</p>
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={member.attending}
                  onchange={() => updateMember(member.id, (current) => ({ ...current, attending: !current.attending }))}
                  class="text-primary focus:ring-ring h-4 w-4 rounded border"
                />
                <span>{member.attending ? 'Kommer' : 'Kommer ikke'}</span>
              </label>
            </div>

            <Textarea
              value={member.notes}
              oninput={(e: Event) =>
                updateMember(member.id, (current) => ({
                  ...current,
                  notes: (e.currentTarget as HTMLTextAreaElement).value
                }))}
              placeholder="Notater (allergier, tilrettelegging, osv.)"
            />
          </li>
        {/each}
      </ul>

      <form
        class="flex flex-col gap-3 sm:flex-row"
        onsubmit={(e) => {
          e.preventDefault();
          addMember();
        }}
      >
        <Input
          type="text"
          value={newMemberName}
          oninput={(e: Event) => (newMemberName = (e.currentTarget as HTMLInputElement).value)}
          placeholder="Legg til familiemedlem"
        />
        <Button type="submit" class="min-w-28 whitespace-nowrap">Legg til</Button>
      </form>

      {#if error}
        <p class="text-sm text-red-600">{error}</p>
      {/if}
      {#if success}
        <p class="text-sm text-green-700">{success}</p>
      {/if}

      <div class="flex justify-end">
        <Button onclick={submitRsvp}>Send svar</Button>
      </div>
    </Card.Content>
  </Card.Root>
</div>