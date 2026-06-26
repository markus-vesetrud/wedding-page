<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { createWebSocket } from '$lib/websocket';
	import { type AppState, type Cake, type WsDeltaType, type Gift, type Guest, type Item, type ListName, type WsDeltaUpdate } from '$shared/types';
	import WelcomeSection from '$lib/components/sections/welcome-section.svelte';
	import PracticalSection from '$lib/components/sections/practical-section.svelte';
	import ProgramSection from '$lib/components/sections/program-section.svelte';
	import GuestSection from '$lib/components/sections/guest-section.svelte';
	import GiftSection from '$lib/components/sections/gift-section.svelte';
	import CakeSection from '$lib/components/sections/cake-section.svelte';
	import { captalize } from '$lib/utils/capitalize';

	type ListKind = 'gift' | 'guest' | 'cake';
	type SectionId = 'velkommen' | 'praktisk' | 'program' | 'gjester' | 'gaver' | 'kaker';

	const TAB_STICKY_TOP_PX = 0;
	const TAB_SCROLL_MARGIN_GAP_PX = 8;

	const sectionTabs: Array<{ id: SectionId; label: string }> = [
		{ id: 'velkommen', label: 'Velkommen' },
		{ id: 'praktisk', label: 'Praktisk' },
		{ id: 'program', label: 'Program' },
		{ id: 'gaver', label: 'Gaver' },
		{ id: 'kaker', label: 'Kaker' },
		{ id: 'gjester', label: 'Gjesteliste' }
	];

	const invitationId = $derived((page.url.searchParams.get('invitationId') ?? '').trim());

	let gifts = $state<Gift[]>([]);
	let guests = $state<Guest[]>([]);
	let cakes = $state<Cake[]>([]);
	let connected = $state(false);
	let activeSection = $state<SectionId>('velkommen');
	let showConnectionStatus = $state(true);
	let newGift = $state('');
	let newCake = $state('');

	let ws: ReturnType<typeof createWebSocket> | null = null;
	let hideConnectionStatusTimer: ReturnType<typeof setTimeout> | null = null;
	let scrollContainerElement: HTMLElement | null = null;
	let tabsNavElement: HTMLElement | null = null;
	let tabResizeObserver: ResizeObserver | null = null;
	let tabBarHeightPx = $state(72);
	let scrollRafId: number | null = null;

	function syncTabMetrics() {
		const measuredHeight = tabsNavElement ? Math.ceil(tabsNavElement.getBoundingClientRect().height) : 0;
		if (measuredHeight > 0) tabBarHeightPx = measuredHeight;
	}

	function stickyOffset() {
		return tabBarHeightPx + TAB_STICKY_TOP_PX + TAB_SCROLL_MARGIN_GAP_PX;
	}

	function updateActiveSectionFromViewport() {
		if (!scrollContainerElement) return;
		const focusLine = scrollContainerElement.scrollTop + scrollContainerElement.clientHeight * 0.3
		let chosen: SectionId = sectionTabs[0].id;

		for (const tab of sectionTabs) {
			const top = sectionTop(tab.id);
			if (top === null) continue;
			if (top <= focusLine) chosen = tab.id;
		}

		activeSection = chosen;
	}

	function queueActiveSectionUpdate() {
		if (scrollRafId !== null) return;
		scrollRafId = requestAnimationFrame(() => {
			scrollRafId = null;
			updateActiveSectionFromViewport();
		});
	}

	function sectionTop(id: SectionId) {
		const section = document.getElementById(id);
		if (!section || !scrollContainerElement) return null;

		const sectionRect = section.getBoundingClientRect();
		const containerRect = scrollContainerElement.getBoundingClientRect();
		const top = sectionRect.top - containerRect.top + scrollContainerElement.scrollTop;
		if (id === 'velkommen') return top;
		return top - stickyOffset();

	}

	function scrollToSection(id: SectionId) {
		const top = sectionTop(id);
		if (top === null) return;

		scrollContainerElement?.scrollTo({ top, behavior: 'smooth' });
	}

	function listName(kind: ListKind): ListName {
		if (kind === 'gift') return 'gifts';
		if (kind === 'guest') return 'guests';
		if (kind === 'cake') return 'cakes';
		throw new Error('Unknown list kind: ' + kind);
	}

	function isSameEntity<T extends Item>(current: T, incoming: T): boolean {
		const currentRecord = current as Record<string, unknown>;
		const incomingRecord = incoming as Record<string, unknown>;

		const currentKeys = Object.keys(currentRecord);
		const incomingKeys = Object.keys(incomingRecord);
		if (currentKeys.length !== incomingKeys.length) return false;

		for (const key of incomingKeys) {
			if (currentRecord[key] !== incomingRecord[key]) return false;
		}

		return true;
	}

	function upsertItem<T extends Item>(list: T[], item: T): T[] {
		const index = list.findIndex((i) => i.id === item.id);
		if (index === -1) return [...list, item];
		if (isSameEntity(list[index], item)) return list;
		const newList = [...list];
		newList[index] = item;
		return newList;
	}

	function applyDelta(update: WsDeltaUpdate) {
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
		action: WsDeltaType,
		payload: Record<string, unknown>
	): Promise<WsDeltaUpdate | null> {
		try {
			const res = await fetch(`/api/${action}/${list}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!res.ok) {
				console.error('list endpoint failed', list, action, res.status);
				return null;
			}

			const json = (await res.json()) as { update?: WsDeltaUpdate };
			return json.update ?? null;
		} catch (error) {
			console.error('list endpoint error', error);
			return null;
		}
	}

	async function applyModalUpdate(updatedElement: Gift | Cake, listName: ListName) {
		const update = await callListEndpoint(listName, 'update', {
			id: updatedElement.id,
			updatedElement
		});
		if (update) applyDelta(update);
	}

	async function addGift() {
		const name = captalize(newGift.trim());
		if (!name) return;
		const update = await callListEndpoint('gifts', 'add', { name });
		if (update) applyDelta(update);
		newGift = '';
	}

	async function addCake() {
		const name = captalize(newCake.trim());
		if (!name) return;
		const update = await callListEndpoint('cakes', 'add', { name });
		if (update) applyDelta(update);
		newCake = '';
	}

	onMount(() => {
		const onResize = () => {
			queueActiveSectionUpdate();
		};

		const onScroll = () => {
			queueActiveSectionUpdate();
		};

		ws = createWebSocket({
			onState: (state: AppState) => {
				gifts = state.gifts ?? [];
				guests = state.guests ?? [];
				cakes = state.cakes ?? [];
				connected = true;
				showConnectionStatus = true;
				requestAnimationFrame(syncTabMetrics);
				if (hideConnectionStatusTimer) clearTimeout(hideConnectionStatusTimer);
				hideConnectionStatusTimer = setTimeout(() => {
					showConnectionStatus = false;
					syncTabMetrics();
					hideConnectionStatusTimer = null;
				}, 1500);
			},
			onDelta: (update) => {
				applyDelta(update);
			}
		});

		if (tabsNavElement) {
			tabResizeObserver = new ResizeObserver(() => {
				syncTabMetrics();
			});
			tabResizeObserver.observe(tabsNavElement);
		}

		syncTabMetrics();
		scrollContainerElement?.addEventListener('resize', onResize);
		scrollContainerElement?.addEventListener('scroll', onScroll, { passive: true });
		queueActiveSectionUpdate();

		return () => {
			scrollContainerElement?.removeEventListener('resize', onResize);
			scrollContainerElement?.removeEventListener('scroll', onScroll);
			tabResizeObserver?.disconnect();
			tabResizeObserver = null;
			if (scrollRafId !== null) {
				cancelAnimationFrame(scrollRafId);
				scrollRafId = null;
			}
		};
	});

	onDestroy(() => {
		ws?.close();
		if (hideConnectionStatusTimer) clearTimeout(hideConnectionStatusTimer);
	});
</script>

<div bind:this={scrollContainerElement} class="main-page">
	<main
		class="mx-auto w-full max-w-2xl px-4 md:px-6"
		style={`--tabs-height: ${tabBarHeightPx}px; --tabs-sticky-top: ${TAB_STICKY_TOP_PX}px; --tabs-scroll-gap: ${TAB_SCROLL_MARGIN_GAP_PX}px;`}
	>
		<WelcomeSection {invitationId} isMainPage={true} />

		<nav bind:this={tabsNavElement} class="sticky top-2 z-30 mb-4 rounded-xl border bg-background/90 p-2 backdrop-blur">
		<ul class="grid grid-cols-2 gap-2 min-[440px]:grid-cols-3 min-[850px]:grid-cols-6">
			{#each sectionTabs as tab}
				<li>
					<button
						type="button"
						onclick={() => scrollToSection(tab.id)}
						class={`w-full rounded-md px-2 py-2 text-sm font-medium transition-colors ${activeSection === tab.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
					>
						{tab.label}
					</button>
				</li>
			{/each}
		</ul>
		{#if !connected || showConnectionStatus}
			<p class="text-muted-foreground mt-2 text-center text-xs">
				{connected ? 'Tilkoblet' : 'Kobler til ...'}
			</p>
		{/if}
		</nav>

		<PracticalSection />
		<ProgramSection />
		<GiftSection
			{gifts}
			isLoading={!connected}
			newGift={newGift}
			onNewGiftChange={(value) => (newGift = value)}
			onAddGift={addGift}
			applyModalUpdate={(gift) => applyModalUpdate(gift, 'gifts')}
		/>
		<CakeSection
			{cakes}
			isLoading={!connected}
			newCake={newCake}
			onNewCakeChange={(value) => (newCake = value)}
			onAddCake={addCake}
			applyModalUpdate={(cake) => applyModalUpdate(cake, 'cakes')}
		/>
		<GuestSection
			{guests}
			isLoading={!connected}
		/>
	</main>
</div>



<style>
	.main-page {
		width: 100%;
		height: 100svh;
		overflow-y: auto;
		scroll-behavior: smooth;
		scroll-snap-type: y proximity;
	}

	.main-page :global(section[id]) {
		scroll-snap-align: start;
	}

	.main-page :global(section[id='velkommen']) {
		scroll-margin-top: 0;
	}

	.main-page :global(section[id]:not([id='velkommen'])) {
		scroll-margin-top: calc(var(--tabs-height, 72px) + var(--tabs-sticky-top, 8px) + var(--tabs-scroll-gap, 8px));
	}

	.main-page :global(main > section[id]:last-of-type) {
		min-height: calc(100svh - var(--tabs-height, 72px) - 8px);
	}
</style>
