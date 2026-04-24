<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { createWebSocket } from '$lib/websocket';
	import type { AppState, Cake, Gift, Guest, Item, ListName, WsDeltaMessage } from '$lib/types';

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
		if (index === -1) {
			return [...list, item];
		}
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
		if (kind === 'gift') return 'Gifter name';
		if (kind === 'cake') return 'Baker name';
		return 'Allergies';
	}

	function checkModalPlaceholder(kind: ListKind): string {
		if (kind === 'gift') return 'Who is gifting this?';
		if (kind === 'cake') return 'Who is baking this?';
		return 'List allergies';
	}

	async function applyCheckModal() {
		const value = checkModalMeta.trim();
		if (!value) {
			checkModalError = `${checkModalLabel(checkModalKind)} is required.`;
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

	// -- Gift actions --
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
			openUncheckModal('gift', item.id, item.name, item.gifterName || 'Unknown gifter');
			return;
		}
		openCheckModal('gift', item.id, item.name, item.gifterName || '');
	}

	// -- Guest actions --
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
			openUncheckModal('guest', item.id, item.name, item.allergies || 'Unknown details');
			return;
		}
		openCheckModal('guest', item.id, item.name, item.allergies || '');
	}

	// -- Cake actions --
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
			openUncheckModal('cake', item.id, item.name, item.bakerName || 'Unknown baker');
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

<div class="status" class:online={connected}>
	{connected ? '🟢 Connected' : '🔴 Connecting…'}
</div>

<section>
	<h2>🎁 Gift Registry</h2>
	<form onsubmit={(e) => { e.preventDefault(); addGift(); }}>
		<input
			type="text"
			bind:value={newGift}
			placeholder="Add a gift…"
		/>
		<button type="submit">Add</button>
	</form>
	<ul>
		{#each gifts as gift (gift.id)}
			<li class:checked={gift.checked}>
				<label>
					<input type="checkbox" checked={gift.checked} onchange={() => toggleGift(gift.id)} />
					<span>{gift.name}</span>
				</label>
			</li>
		{/each}
	</ul>
</section>

<section>
	<h2>🎂 Cake List</h2>
	<form onsubmit={(e) => { e.preventDefault(); addCake(); }}>
		<input
			type="text"
			bind:value={newCake}
			placeholder="Add a cake…"
		/>
		<button type="submit">Add</button>
	</form>
	<ul>
		{#each cakes as cake (cake.id)}
			<li class:checked={cake.checked}>
				<label>
					<input type="checkbox" checked={cake.checked} onchange={() => toggleCake(cake.id)} />
					<span>{cake.name}</span>
				</label>
			</li>
		{/each}
	</ul>
</section>

<section>
	<h2>📋 Guest List</h2>
	<form onsubmit={(e) => { e.preventDefault(); addGuest(); }}>
		<input
			type="text"
			bind:value={newGuest}
			placeholder="Add a guest…"
		/>
		<button type="submit">Add</button>
	</form>
	<ul>
		{#each guests as guest (guest.id)}
			<li class:checked={guest.checked}>
				<label>
					<input type="checkbox" checked={guest.checked} onchange={() => toggleGuest(guest.id)} />
					<span>{guest.name}</span>
				</label>
			</li>
		{/each}
	</ul>
</section>

{#if checkModalOpen}
	<div class="modal-backdrop" role="presentation">
		<div class="modal" role="dialog" aria-modal="true" aria-label="Confirm item details">
			<h3>Before checking “{checkModalItemName}”</h3>
			<p>Please fill in this field first.</p>
			<label class="modal-label" for="check-meta">{checkModalLabel(checkModalKind)}</label>
			<input
				id="check-meta"
				type="text"
				bind:value={checkModalMeta}
				placeholder={checkModalPlaceholder(checkModalKind)}
			/>
			{#if checkModalError}
				<p class="modal-error">{checkModalError}</p>
			{/if}
			<div class="modal-actions">
				<button type="button" class="secondary" onclick={closeCheckModal}>Cancel</button>
				<button type="button" onclick={applyCheckModal}>Save and check</button>
			</div>
		</div>
	</div>
{/if}

{#if uncheckModalOpen}
	<div class="modal-backdrop" role="presentation">
		<div class="modal" role="dialog" aria-modal="true" aria-label="Confirm uncheck">
			<h3>Uncheck “{uncheckModalItemName}”?</h3>
			<p>
				Recorded by: <strong>{uncheckModalActor}</strong>. Was this you?
			</p>
			<div class="modal-actions">
				<button type="button" class="secondary" onclick={closeUncheckModal}>Cancel</button>
				<button type="button" onclick={confirmUncheck}>Yes, uncheck</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.status {
		text-align: center;
		font-size: 0.85rem;
		padding: 0.4rem;
		color: #999;
	}
	.status.online {
		color: #5a9a5a;
	}

	section {
		background: white;
		border-radius: 12px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
	}

	h2 {
		margin: 0 0 1rem;
		font-weight: 400;
		color: #6b5b4f;
	}

	form {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	input[type='text'] {
		flex: 1;
		padding: 0.5rem 0.75rem;
		border: 1px solid #ddd;
		border-radius: 8px;
		font-size: 0.95rem;
	}

	button {
		padding: 0.5rem 1rem;
		background: #6b5b4f;
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.9rem;
	}
	button:hover {
		background: #5a4a3f;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0;
		border-bottom: 1px solid #f0ede8;
	}
	li:last-child {
		border-bottom: none;
	}

	li.checked span {
		text-decoration: line-through;
		opacity: 0.5;
	}

	label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		flex: 1;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		z-index: 10;
	}

	.modal {
		background: white;
		border-radius: 12px;
		padding: 1rem;
		width: min(28rem, 100%);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
	}

	.modal h3 {
		margin: 0 0 0.5rem;
		font-weight: 500;
	}

	.modal p {
		margin: 0 0 0.75rem;
	}

	.modal-label {
		display: block;
		font-size: 0.9rem;
		margin-bottom: 0.4rem;
	}

	.modal-error {
		font-size: 0.85rem;
		color: #c44;
		margin-top: 0.4rem;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	button.secondary {
		background: #ddd;
		color: #333;
	}

	button.secondary:hover {
		background: #cfcfcf;
	}
</style>
