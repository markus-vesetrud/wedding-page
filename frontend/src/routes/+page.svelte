<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { createWebSocket } from '$lib/websocket';
	import { Attendance, type AppState, type Cake, type WsDeltaType, type Gift, type Guest, type Item, type ListName, type WsDeltaUpdate } from '$shared/types';
	import WelcomeSection from '$lib/components/sections/welcome-section.svelte';
	import PracticalSection from '$lib/components/sections/practical-section.svelte';
	import ProgramSection from '$lib/components/sections/program-section.svelte';
	import GuestSection from '$lib/components/sections/guest-section.svelte';
	import GiftSection from '$lib/components/sections/gift-section.svelte';
	import CakeSection from '$lib/components/sections/cake-section.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';

	type ListKind = 'gift' | 'guest' | 'cake';
	type SectionId = 'velkommen' | 'praktisk' | 'program' | 'gjester' | 'gaver' | 'kaker';

	const TAB_STICKY_TOP_PX = 8;
	const TAB_SCROLL_MARGIN_GAP_PX = 8;

	const sectionTabs: Array<{ id: SectionId; label: string }> = [
		{ id: 'velkommen', label: 'Velkommen' },
		{ id: 'praktisk', label: 'Praktisk' },
		{ id: 'program', label: 'Program' },
		{ id: 'gaver', label: 'Gaver' },
		{ id: 'kaker', label: 'Kaker' },
		{ id: 'gjester', label: 'Gjesteliste' }
	];

	let gifts = $state<Gift[]>([]);
	let guests = $state<Guest[]>([]);
	let cakes = $state<Cake[]>([]);
	let connected = $state(false);
	let activeSection = $state<SectionId>('velkommen');
	let showConnectionStatus = $state(true);
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
	let hideConnectionStatusTimer: ReturnType<typeof setTimeout> | null = null;
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
		const focusLine = window.scrollY + window.innerHeight * 0.3;
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
		if (!section) return null;
		if (id === 'velkommen') return section.getBoundingClientRect().top + window.scrollY;
		return section.getBoundingClientRect().top + window.scrollY - stickyOffset();
	}

	function scrollToSection(id: SectionId) {
		const top = sectionTop(id);
		if (top === null) return;
		window.scrollTo({ top, behavior: 'smooth' });
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
		const patch: Record<string, unknown> = {
			[field]: value
		};
		if (checkModalKind === 'gift' || checkModalKind === 'cake') {
			patch.claimed = true;
		}
		if (checkModalKind === 'guest') {
			patch.attendance = Attendance.Attending;
		}

		const update = await callListEndpoint(list, 'update', {
			id: checkModalItemId,
			patch
		});
		if (update) applyDelta(update);
		closeCheckModal();
	}

	async function confirmUncheck() {
		const list = listName(uncheckModalKind);
		const patch =
			uncheckModalKind === 'guest'
				? { attendance: Attendance.NotAttending }
				: { claimed: false };
		const update = await callListEndpoint(list, 'update', {
			id: uncheckModalItemId,
			patch
		});
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
		if (item.claimed) {
			openUncheckModal('gift', item.id, item.name, item.gifterName || 'Ukjent gavegiver');
			return;
		}
		openCheckModal('gift', item.id, item.name, item.gifterName || '');
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
		if (item.claimed) {
			openUncheckModal('cake', item.id, item.name, item.bakerName || 'Ukjent baker');
			return;
		}
		openCheckModal('cake', item.id, item.name, item.bakerName || '');
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
		window.addEventListener('resize', onResize);
		window.addEventListener('scroll', onScroll, { passive: true });
		queueActiveSectionUpdate();

		return () => {
			window.removeEventListener('resize', onResize);
			window.removeEventListener('scroll', onScroll);
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

<div
	class="mx-auto w-full max-w-2xl px-4 py-8 md:px-6 lg:py-12"
	style={`--tabs-height: ${tabBarHeightPx}px; --tabs-sticky-top: ${TAB_STICKY_TOP_PX}px; --tabs-scroll-gap: ${TAB_SCROLL_MARGIN_GAP_PX}px;`}
>
	<main>
		<WelcomeSection />

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
			onToggleGift={toggleGift}
		/>
		<CakeSection
			{cakes}
			isLoading={!connected}
			newCake={newCake}
			onNewCakeChange={(value) => (newCake = value)}
			onAddCake={addCake}
			onToggleCake={toggleCake}
		/>
    <GuestSection
			{guests}
			isLoading={!connected}
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

<style>
	:global(html) {
		scroll-behavior: smooth;
		scroll-snap-type: y proximity;
	}

	:global(section[id]) {
		scroll-snap-align: start;
	}

	:global(section[id='velkommen']) {
		scroll-margin-top: 0;
	}

	:global(section[id]:not([id='velkommen'])) {
		scroll-margin-top: calc(var(--tabs-height, 72px) + var(--tabs-sticky-top, 8px) + var(--tabs-scroll-gap, 8px));
	}

	:global(main > section[id]:last-of-type) {
		min-height: calc(100svh - var(--tabs-height, 72px));
	}
  
</style>

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
