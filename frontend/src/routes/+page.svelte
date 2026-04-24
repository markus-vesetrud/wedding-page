<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { createWebSocket } from '$lib/websocket';
	import type { AppState, Cake, Gift, Guest, Item, ListName, WsDeltaMessage } from '$lib/types';
	import WelcomeSection from '$lib/components/sections/welcome-section.svelte';
	import GuestSection from '$lib/components/sections/guest-section.svelte';
	import GiftSection from '$lib/components/sections/gift-section.svelte';
	import CakeSection from '$lib/components/sections/cake-section.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';

	type ListKind = 'gift' | 'guest' | 'cake';

	let gifts = $state<Gift[]>([]);
	let guests = $state<Guest[]>([]);
	let cakes = $state<Cake[]>([]);
	let connected = $state(false);
	let newGift = $state('');
	let newGuest = $state('');
	let newCake = $state('');

	let checkModalOpen = $state(false);
	let checkModalKind = $state<ListKind>('gift');
	let checkModalItemId = $state('');
	let checkModalItemName = $state('');
	let checkModalMeta = $state('');
	let checkModalError = $state('');

	let uncheckModalOpen = $state(false);
	let uncheckModalKind = $state<ListKind>('gift');
	let uncheckModalItemId = $state('');
	let uncheckModalItemName = $state('');
	let uncheckModalActor = $state('');

	let ws: ReturnType<typeof createWebSocket> | null = null;

	function listName(kind: ListKind): ListName {
		if (kind === 'gift') return 'gifts';
		if (kind === 'guest') return 'guests';
		if (kind === 'cake') return 'cakes';
		throw new Error('Unknown list kind: ' + kind);
	}

	function upsertItem<T extends Item>(list: T[], item: T): T[] {
		const index = list.findIndex((i) => i.id === item.id);
		if (index === -1) return [...list, item];
		const newList = [...list];
		newList[index] = item;
		return newList;
	}

	function applyDelta(update: WsDeltaMessage) {
		if (update.list === 'gifts') {
			gifts = upsertItem(gifts, update.item as Gift);
			return;
		}
		if (update.list === 'guests') {
			guests = upsertItem(guests, update.item as Guest);
			return;
		}
		if (update.list === 'cakes') {
			cakes = upsertItem(cakes, update.item as Cake);
			return;
		}
		console.warn('Unknown list in update', update);
	}

	async function callListEndpoint(
		list: ListName,
		action: 'add' | 'checked' | 'unchecked',
		payload: Record<string, unknown>
	): Promise<WsDeltaMessage | null> {
		try {
			const res = await fetch(`/api/lists/${list}/${action}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!res.ok) {
				console.error('list endpoint failed', list, action, res.status);
				return null;
			}

			const json = (await res.json()) as { update?: WsDeltaMessage };
			return json.update ?? null;
		} catch (error) {
			console.error('list endpoint error', error);
			return null;
		}
	}

	function openCheckModal(kind: ListKind, itemId: string, itemName: string, initialValue = '') {
		checkModalKind = kind;
		checkModalItemId = itemId;
		checkModalItemName = itemName;
		checkModalMeta = initialValue;
		checkModalError = '';
		checkModalOpen = true;
	}

	function closeCheckModal() {
		checkModalOpen = false;
		checkModalError = '';
	}

	function openUncheckModal(kind: ListKind, itemId: string, itemName: string, actor: string) {
		uncheckModalKind = kind;
		uncheckModalItemId = itemId;
		uncheckModalItemName = itemName;
		uncheckModalActor = actor;
		uncheckModalOpen = true;
	}

	function closeUncheckModal() {
		uncheckModalOpen = false;
	}

	function checkModalLabel(kind: ListKind): string {
		if (kind === 'gift') return 'Navn på gavegiver';
		if (kind === 'cake') return 'Navn på baker';
		return 'Allergier (kun synlig for arrangørene)';
	}

	function checkModalPlaceholder(kind: ListKind): string {
		if (kind === 'gift') return 'Hvem gir denne gaven?';
		if (kind === 'cake') return 'Hvem baker denne kaken?';
		return 'F.eks. nøtter, gluten, laktose';
	}

	function checkModalHelpText(kind: ListKind): string {
		if (kind === 'guest') {
			return 'Denne informasjonen brukes kun til planlegging av mat og vises ikke i gjestelisten.';
		}
		return 'Dette navnet brukes for å vise hvem som har reservert punktet.';
	}

	async function applyCheckModal() {
		const value = checkModalMeta.trim();
		if (!value) {
			checkModalError = `${checkModalLabel(checkModalKind)} må fylles ut.`;
			return;
		}

		const list = listName(checkModalKind);
		const field = checkModalKind === 'gift' ? 'gifterName' : checkModalKind === 'cake' ? 'bakerName' : 'allergies';
		const update = await callListEndpoint(list, 'checked', {
			id: checkModalItemId,
			[field]: value
		});
		if (update) applyDelta(update);
		closeCheckModal();
	}

	async function confirmUncheck() {
		const list = listName(uncheckModalKind);
		const update = await callListEndpoint(list, 'unchecked', { id: uncheckModalItemId });
		if (update) applyDelta(update);
		closeUncheckModal();
	}

	async function addGift() {
		const name = newGift.trim();
		if (!name) return;
		const update = await callListEndpoint('gifts', 'add', { name });
		if (update) applyDelta(update);
		newGift = '';
	}

	function toggleGift(id: string) {
		const item = gifts.find((g) => g.id === id);
		if (!item) return;
		if (item.checked) {
			openUncheckModal('gift', item.id, item.name, item.gifterName || 'Ukjent gavegiver');
			return;
		}
		openCheckModal('gift', item.id, item.name, item.gifterName || '');
	}

	async function addGuest() {
		const name = newGuest.trim();
		if (!name) return;
		const update = await callListEndpoint('guests', 'add', { name });
		if (update) applyDelta(update);
		newGuest = '';
	}

	function toggleGuest(id: string) {
		const item = guests.find((g) => g.id === id);
		if (!item) return;
		if (item.checked) {
			openUncheckModal('guest', item.id, item.name, 'Privat');
			return;
		}
		openCheckModal('guest', item.id, item.name, item.allergies || '');
	}

	async function addCake() {
		const name = newCake.trim();
		if (!name) return;
		const update = await callListEndpoint('cakes', 'add', { name });
		if (update) applyDelta(update);
		newCake = '';
	}

	function toggleCake(id: string) {
		const item = cakes.find((c) => c.id === id);
		if (!item) return;
		if (item.checked) {
			openUncheckModal('cake', item.id, item.name, item.bakerName || 'Ukjent baker');
			return;
		}
		openCheckModal('cake', item.id, item.name, item.bakerName || '');
	}

	onMount(() => {
		ws = createWebSocket({
			onState: (state: AppState) => {
				gifts = state.gifts ?? [];
				guests = state.guests ?? [];
				cakes = state.cakes ?? [];
				connected = true;
			},
			onDelta: (update) => {
				applyDelta(update);
			}
		});
	});

	onDestroy(() => {
		ws?.close();
	});
</script>

<div class="mx-auto w-full max-w-5xl px-4 py-8 md:px-6 lg:py-12">
	<main class="divide-y divide-border">
		<WelcomeSection />
		<GuestSection
			{guests}
			newGuest={newGuest}
			onNewGuestChange={(value) => (newGuest = value)}
			onAddGuest={addGuest}
			onToggleGuest={toggleGuest}
		/>
		<GiftSection
			{gifts}
			newGift={newGift}
			onNewGiftChange={(value) => (newGift = value)}
			onAddGift={addGift}
			onToggleGift={toggleGift}
		/>
		<CakeSection
			{cakes}
			newCake={newCake}
			onNewCakeChange={(value) => (newCake = value)}
			onAddCake={addCake}
			onToggleCake={toggleCake}
		/>
	</main>
</div>

{#if checkModalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
		<Card.Root class="w-full max-w-md">
			<Card.Header>
				<Card.Title>Før du huker av “{checkModalItemName}”</Card.Title>
				<Card.Description>{checkModalHelpText(checkModalKind)}</Card.Description>
			</Card.Header>
			<Card.Content>
				<label class="text-sm font-medium" for="check-meta">{checkModalLabel(checkModalKind)}</label>
				{#if checkModalKind === 'guest'}
					<Textarea
						id="check-meta"
						value={checkModalMeta}
						oninput={(e: Event) => (checkModalMeta = (e.currentTarget as HTMLTextAreaElement).value)}
						placeholder={checkModalPlaceholder(checkModalKind)}
					/>
				{:else}
					<Input
						id="check-meta"
						type="text"
						value={checkModalMeta}
						oninput={(e: Event) => (checkModalMeta = (e.currentTarget as HTMLInputElement).value)}
						placeholder={checkModalPlaceholder(checkModalKind)}
					/>
				{/if}
				{#if checkModalError}
					<p class="text-sm text-red-600">{checkModalError}</p>
				{/if}
				<div class="flex justify-end gap-2 pt-2">
					<Button variant="outline" onclick={closeCheckModal}>Avbryt</Button>
					<Button onclick={applyCheckModal}>Lagre og huk av</Button>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
{/if}

{#if uncheckModalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
		<Card.Root class="w-full max-w-md">
			<Card.Header>
				<Card.Title>Fjern avhuking på “{uncheckModalItemName}”?</Card.Title>
				{#if uncheckModalKind === 'guest'}
					<Card.Description>
						Allergiopplysninger for gjester er private. Bekreft bare hvis du vil endre din egen registrering.
					</Card.Description>
				{:else}
					<Card.Description>Registrert av: {uncheckModalActor}.</Card.Description>
				{/if}
			</Card.Header>
			<Card.Content>
				<div class="flex justify-end gap-2">
					<Button variant="outline" onclick={closeUncheckModal}>Avbryt</Button>
					<Button onclick={confirmUncheck}>Ja, fjern</Button>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
{/if}
