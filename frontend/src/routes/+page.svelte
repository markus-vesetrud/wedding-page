<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { createWebSocket } from '$lib/websocket';
	import type { AppState, Cake, Gift, Guest } from '$lib/types';

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

	function makeId(): string {
		return Math.random().toString(36).slice(2, 10);
	}

	function now(): Date {
		return new Date();
	}

	function currentState(): AppState {
		return {
			gifts: $state.snapshot(gifts),
			guests: $state.snapshot(guests),
			cakes: $state.snapshot(cakes)
		};
	}

	function broadcastState() {
		ws?.sendUpdate(currentState());
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

	function applyCheckModal() {
		const value = checkModalMeta.trim();
		if (!value) {
			checkModalError = `${checkModalLabel(checkModalKind)} is required.`;
			return;
		}

		if (checkModalKind === 'gift') {
			const item = gifts.find((gift) => gift.id === checkModalItemId);
			if (!item) return;
			item.checked = true;
			item.gifterName = value;
			item.updatedAt = now();
		}

		if (checkModalKind === 'cake') {
			const item = cakes.find((cake) => cake.id === checkModalItemId);
			if (!item) return;
			item.checked = true;
			item.bakerName = value;
			item.updatedAt = now();
		}

		if (checkModalKind === 'guest') {
			const item = guests.find((guest) => guest.id === checkModalItemId);
			if (!item) return;
			item.checked = true;
			item.allergies = value;
			item.updatedAt = now();
		}

		closeCheckModal();
		broadcastState();
	}

	function confirmUncheck() {
		if (uncheckModalKind === 'gift') {
			const item = gifts.find((gift) => gift.id === uncheckModalItemId);
			if (!item) return;
			item.checked = false;
			item.updatedAt = now();
		}

		if (uncheckModalKind === 'cake') {
			const item = cakes.find((cake) => cake.id === uncheckModalItemId);
			if (!item) return;
			item.checked = false;
			item.updatedAt = now();
		}

		if (uncheckModalKind === 'guest') {
			const item = guests.find((guest) => guest.id === uncheckModalItemId);
			if (!item) return;
			item.checked = false;
			item.updatedAt = now();
		}

		closeUncheckModal();
		broadcastState();
	}

	// -- Gift actions --
	function addGift() {
		const name = newGift.trim();
		if (!name) return;
		gifts.push({ id: makeId(), name, checked: false, updatedAt: now() });
		newGift = '';
		broadcastState();
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

	function removeGift(id: string) {
		gifts = gifts.filter((g) => g.id !== id);
		broadcastState();
	}

	// -- Guest actions --
	function addGuest() {
		const name = newGuest.trim();
		if (!name) return;
		guests.push({ id: makeId(), name, checked: false, updatedAt: now() });
		newGuest = '';
		broadcastState();
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

	function removeGuest(id: string) {
		guests = guests.filter((g) => g.id !== id);
		broadcastState();
	}

	// -- Cake actions --
	function addCake() {
		const name = newCake.trim();
		if (!name) return;
		cakes.push({ id: makeId(), name, checked: false, updatedAt: now(), servings: 0 });
		newCake = '';
		broadcastState();
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

	function removeCake(id: string) {
		cakes = cakes.filter((c) => c.id !== id);
		broadcastState();
	}

	onMount(() => {
		ws = createWebSocket((state: AppState) => {
			gifts = state.gifts ?? [];
			guests = state.guests ?? [];
			cakes = state.cakes ?? [];
			connected = true;
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
				<button class="remove" onclick={() => removeGift(gift.id)}>✕</button>
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
				<button class="remove" onclick={() => removeCake(cake.id)}>✕</button>
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
				<button class="remove" onclick={() => removeGuest(guest.id)}>✕</button>
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

	.remove {
		background: none;
		color: #ccc;
		padding: 0.25rem 0.5rem;
		font-size: 0.8rem;
	}
	.remove:hover {
		color: #c44;
		background: none;
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
