<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { createWebSocket } from '$lib/websocket';
	import type { AppState, ListItem } from '$lib/types';

	let gifts = $state<ListItem[]>([]);
	let guests = $state<ListItem[]>([]);
	let connected = $state(false);
	let newGift = $state('');
	let newGuest = $state('');

	let ws: ReturnType<typeof createWebSocket> | null = null;

	function makeId(): string {
		return Math.random().toString(36).slice(2, 10);
	}

	function currentState(): AppState {
		return { gifts: $state.snapshot(gifts), guests: $state.snapshot(guests) };
	}

	function broadcastState() {
		ws?.sendUpdate(currentState());
	}

	// -- Gift actions --
	function addGift() {
		const text = newGift.trim();
		if (!text) return;
		gifts.push({ id: makeId(), text, checked: false });
		newGift = '';
		broadcastState();
	}

	function toggleGift(id: string) {
		const item = gifts.find((g) => g.id === id);
		if (item) item.checked = !item.checked;
		broadcastState();
	}

	function removeGift(id: string) {
		gifts = gifts.filter((g) => g.id !== id);
		broadcastState();
	}

	// -- Guest actions --
	function addGuest() {
		const text = newGuest.trim();
		if (!text) return;
		guests.push({ id: makeId(), text, checked: false });
		newGuest = '';
		broadcastState();
	}

	function toggleGuest(id: string) {
		const item = guests.find((g) => g.id === id);
		if (item) item.checked = !item.checked;
		broadcastState();
	}

	function removeGuest(id: string) {
		guests = guests.filter((g) => g.id !== id);
		broadcastState();
	}

	onMount(() => {
		ws = createWebSocket((state: AppState) => {
			gifts = state.gifts;
			guests = state.guests;
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
					<span>{gift.text}</span>
				</label>
				<button class="remove" onclick={() => removeGift(gift.id)}>✕</button>
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
					<span>{guest.text}</span>
				</label>
				<button class="remove" onclick={() => removeGuest(guest.id)}>✕</button>
			</li>
		{/each}
	</ul>
</section>

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
</style>
