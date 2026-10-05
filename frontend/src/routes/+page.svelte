<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { createWebSocket } from '$lib/websocket';
	import { type PublicAppState, type Cake, type WsDeltaType, type Gift, type Guest, type Item, type ListName, type WsDeltaUpdate } from '$shared/types';
	import WelcomeHero from '$lib/components/sections/welcome-hero.svelte';
	import WelcomeDetails from '$lib/components/sections/welcome-details.svelte';
	import ProgramSection from '$lib/components/sections/program-section.svelte';
	import GuestSection from '$lib/components/sections/guest-section.svelte';
	import GiftSection from '$lib/components/sections/gift-section.svelte';
	import CakeSection from '$lib/components/sections/cake-section.svelte';
	import SpeechSection from '$lib/components/sections/speech-section.svelte';
	import PhotoSection from '$lib/components/sections/photo-section.svelte';
	import Back from '$lib/components/ui/icon/back.svelte';

	type SectionId = 'velkommen' | 'program' | 'gjester' | 'gaver' | 'kaker' | 'taler' | 'bilder';

	const sectionTabs: Array<{ id: SectionId; label: string }> = [
		{ id: 'velkommen', label: 'Velkommen' },
		{ id: 'program', label: 'Program' },
		{ id: 'taler', label: 'Taler' },
		{ id: 'gaver', label: 'Gaver' },
		{ id: 'kaker', label: 'Kaker' },
		{ id: 'bilder', label: 'Bilder' },
		// { id: 'gjester', label: 'Gjesteliste' }
	];

	const invitationId = $derived((page.url.searchParams.get('invitationId') ?? '').trim());
	const backToInvitationHref = $derived(
		invitationId ? `/invitasjon/${encodeURIComponent(invitationId)}` : ''
	);

	let gifts = $state<Gift[]>([]);
	let guests = $state<Guest[]>([]);
	let cakes = $state<Cake[]>([]);
	let connected = $state(false);
	let activeSection = $state<SectionId>('velkommen');
	let newGift = $state('');
	let newCake = $state('');
	let cakeSuggestionSubmitted = $state(false);
	let cakeSuggestionSubmittedTimer: ReturnType<typeof setTimeout> | null = null;

	let ws: ReturnType<typeof createWebSocket> | null = null;
	let scrollContainerElement: HTMLElement | null = null;
	let tabsNavElement: HTMLElement | null = null;
	let tabResizeObserver: ResizeObserver | null = null;
	let tabsRowElement: HTMLElement | null = null;
	let invitationLinkElement = $state<HTMLElement | null>(null);
	let tabListElement: HTMLElement | null = null;
	let tabBarHeightPx = $state(72);
	let stackInvitationLink = $state(false);
	let scrollRafId: number | null = null;

	// Move the invitation link above the tabs once the tabs beside it would wrap to this many rows
	const STACK_AT_TAB_ROWS = 3;

	function syncTabMetrics() {
		const measuredHeight = tabsNavElement ? Math.ceil(tabsNavElement.getBoundingClientRect().height) : 0;
		if (measuredHeight > 0) tabBarHeightPx = measuredHeight;
		syncInvitationLinkPlacement();
	}

	function syncInvitationLinkPlacement() {
		if (!tabsRowElement || !invitationLinkElement || !tabListElement) {
			stackInvitationLink = false;
			return;
		}

		// Simulate wrapping the tabs into the width they would get beside the link
		const rowStyle = getComputedStyle(tabsRowElement);
		const rowGap = parseFloat(rowStyle.columnGap) || 0;
		const contentWidth =
			tabsRowElement.clientWidth - parseFloat(rowStyle.paddingLeft) - parseFloat(rowStyle.paddingRight);
		const dividerWidth = 1;
		const availableWidth =
			contentWidth - invitationLinkElement.getBoundingClientRect().width - dividerWidth - rowGap * 2;

		const tabGap = parseFloat(getComputedStyle(tabListElement).columnGap) || 0;
		let rows = 1;
		let lineWidth = 0;
		for (const tab of tabListElement.children) {
			const tabWidth = tab.getBoundingClientRect().width;
			const nextWidth = lineWidth === 0 ? tabWidth : lineWidth + tabGap + tabWidth;
			if (lineWidth > 0 && nextWidth > availableWidth) {
				rows += 1;
				lineWidth = tabWidth;
			} else {
				lineWidth = nextWidth;
			}
		}

		stackInvitationLink = rows >= STACK_AT_TAB_ROWS;
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
		return top - tabBarHeightPx;

	}

	function scrollToSection(id: SectionId) {
		const top = sectionTop(id);
		if (top === null) return;

		scrollContainerElement?.scrollTo({ top, behavior: 'smooth' });
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
		const { id, updatedAt, ...patch } = updatedElement;
		const update = await callListEndpoint(listName, 'update', { id, patch });
		if (update) applyDelta(update);
	}

	async function addGift(name: string, gifterName?: string) {
		const update = await callListEndpoint('gifts', 'add', { name, gifterName });
		if (update) applyDelta(update);
		newGift = '';
	}

	async function addCake(name: string, bakerName?: string) {
		const update = await callListEndpoint('cakeSuggestions', 'add', { name, bakerName });
		newCake = '';
		if (!update) return;

		cakeSuggestionSubmitted = true;
		if (cakeSuggestionSubmittedTimer) clearTimeout(cakeSuggestionSubmittedTimer);
		cakeSuggestionSubmittedTimer = setTimeout(() => {
			cakeSuggestionSubmitted = false;
			cakeSuggestionSubmittedTimer = null;
		}, 4000);
	}

	onMount(() => {
		const onResize = () => {
			queueActiveSectionUpdate();
		};

		const onScroll = () => {
			queueActiveSectionUpdate();
		};

		ws = createWebSocket({
			onState: (state: PublicAppState) => {
				gifts = state.gifts ?? [];
				guests = state.guests ?? [];
				cakes = state.cakes ?? [];
				connected = true;
				requestAnimationFrame(syncTabMetrics);
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
		document.fonts?.ready.then(syncTabMetrics);
		window.addEventListener('resize', onResize);
		scrollContainerElement?.addEventListener('scroll', onScroll, { passive: true });
		scrollContainerElement?.addEventListener('scrollend', onScroll, { passive: true });
		queueActiveSectionUpdate();

		return () => {
			window.removeEventListener('resize', onResize);
			scrollContainerElement?.removeEventListener('scroll', onScroll);
			scrollContainerElement?.removeEventListener('scrollend', onScroll);
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
		if (cakeSuggestionSubmittedTimer) clearTimeout(cakeSuggestionSubmittedTimer);
	});
</script>

<div bind:this={scrollContainerElement} class="main-page">
	<main
		class="mx-auto w-full max-w-2xl px-4 md:px-6 mb-4"
		style={`--tabs-height: ${tabBarHeightPx}px;`}
	>
		<WelcomeHero showCountDown showCeremonyLine />

		<nav
			bind:this={tabsNavElement}
			class="sticky top-0 z-30 mb-4 ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] w-screen border-y border-border bg-muted/90 backdrop-blur [transform:translateZ(0)]"
		>
			<div
				bind:this={tabsRowElement}
				class={`mx-auto flex w-full max-w-2xl gap-2 px-4 py-1.5 md:px-6 ${stackInvitationLink ? 'flex-col items-start gap-1' : 'items-stretch'}`}
			>
				{#if invitationId}
					<a
						bind:this={invitationLinkElement}
						href={backToInvitationHref}
						class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-sm font-medium hover:bg-card"
					>
						<Back size={16} /><span>Invitasjon</span>
					</a>
					<div
						class={`shrink-0 bg-border ${stackInvitationLink ? 'h-px self-stretch' : 'w-px self-stretch'}`}
					></div>
				{/if}
				<ul
					bind:this={tabListElement}
					class="flex flex-1 flex-wrap content-start items-start gap-x-0.5 gap-y-1 self-stretch"
				>
					{#each sectionTabs as tab}
						<li>
							<button
								type="button"
								onclick={() => scrollToSection(tab.id)}
								class={`flex items-center gap-1.5 rounded-md py-1 pl-1.5 pr-[1.125rem] text-left text-sm font-medium whitespace-nowrap transition-colors hover:bg-card ${activeSection === tab.id ? 'text-accent' : 'text-muted-foreground hover:text-accent'}`}
							>
								<span
									class={`h-1.5 w-1.5 shrink-0 rounded-full bg-accent transition-opacity ${activeSection === tab.id ? 'opacity-100' : 'opacity-0'}`}
								></span>
								<span>{tab.label}</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		</nav>

		<WelcomeDetails />

		<div class="mt-12">
			<ProgramSection />
			<SpeechSection />
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
				{cakeSuggestionSubmitted}
				applyModalUpdate={(cake) => applyModalUpdate(cake, 'cakes')}
			/>
			<PhotoSection />
			<!-- <GuestSection
				{guests}
				isLoading={!connected}
			/> -->
		</div>

		<footer class="ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] w-screen border-t border-border py-20 text-center">
			<p class="font-serif text-2xl italic">Malin &amp; Markus</p>
			<p class="mt-1.5 text-md tracking-wide text-muted-foreground">31. juli 2027 · Nittedal</p>
		</footer>

	</main>
</div>



<style>

	.main-page {
		width: 100%;
		height: 100svh;
		overflow-y: auto;
		scroll-behavior: smooth;
		background: var(--background);
	}

	.main-page :global(section[id]) {
		scroll-snap-align: start;
	}

	.main-page :global(section[id='velkommen']) {
		scroll-margin-top: 0;
	}

	.main-page :global(section[id]:not([id='velkommen'])) {
		scroll-margin-top: calc(var(--tabs-height, 88px));
	}
</style>
