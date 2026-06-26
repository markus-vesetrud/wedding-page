<script lang="ts">
	import type { Gift } from '$shared/types';
	import { sortByClaimedAndUpdatedAt } from '$lib/item-sorting';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import SectionShell from '$lib/components/sections/section-shell.svelte';
	import AnimatedList from '$lib/components/animated-list.svelte';
	import CheckModal from '../check-modal.svelte';
	import { normalizeName } from '$lib/utils/capitalize';

	let {
		gifts,
		isLoading,
		newGift,
		onNewGiftChange,
		onAddGift,
		applyModalUpdate,
	}: {
		gifts: Gift[];
		isLoading: boolean;
		newGift: string;
		onNewGiftChange: (value: string) => void;
		onAddGift: () => void;
		applyModalUpdate: (gift: Gift) => void;
	} = $props();

	type ModalState = 'closed' | 'checked' | 'unchecked';

	let modalState = $state<ModalState>('closed');
	let modalGift = $state<Gift | undefined>();
	let inputGifterName = $state('');

	function openCheckModal(gift: Gift) {
		modalState = 'checked';
		modalGift = gift;
		inputGifterName = '';
	}

	function openUncheckModal(gift: Gift) {
		modalState = 'unchecked';
		modalGift = gift;
		modalGift.gifterName ??= 'Ukjent gavegiver'
	}

	function closeModal() {
		modalState = 'closed';
		modalGift = undefined;
		inputGifterName = '';
	}

	function toggleGift(id: string) {
		const item = gifts.find((g) => g.id === id);
		if (!item) return;
		if (item.claimed) {
			openUncheckModal(item);
			return;
		}
		openCheckModal(item);
	}

	const sortedGifts = $derived(sortByClaimedAndUpdatedAt(gifts));
</script>

<SectionShell
	id="gaver"
	title="Gaveliste"
	ingress="Denne listen er kun et forslag, og er laget for å unngå duplikate gaver. Hvis du vil gi noe annet enn det som står her, kan du legge til et nytt forslag."
>
	<div class="space-y-3">
		<AnimatedList items={sortedGifts} {isLoading} emptyText="Ingen gaveønsker i listen ennå." loadingCount={4}>
			{#snippet children(gift)}
				<div class="flex items-center justify-between">
					<label class="flex items-center gap-3">
						<input
							type="checkbox"
							checked={gift.claimed}
							onclick={(e) => {
								e.preventDefault();
								toggleGift(gift.id);
							}}
							class="text-primary focus:ring-ring h-4 w-4 rounded border"
						/>
						<span class={gift.claimed ? 'text-muted-foreground line-through' : ''}>{gift.name}</span>
					</label>
					<span class="text-muted-foreground text-xs">{gift.claimed ? 'Reservert' : 'Ledig'}</span>
				</div>
			{/snippet}
		</AnimatedList>
		<form
			class="flex flex-col gap-3 sm:flex-row"
			onsubmit={(e) => {
				e.preventDefault();
				onAddGift();
			}}
		>
			<Input
				type="text"
				value={newGift}
				oninput={(e: Event) => onNewGiftChange((e.currentTarget as HTMLInputElement).value)}
				placeholder="Legg til gaveønske"
				required
			/>
			<Button type="submit" class="min-w-28 whitespace-nowrap">Legg til</Button>
		</form>

		{#if modalGift !== undefined}
			<CheckModal  
				open={modalState == 'checked'}
				title='Før du huker av "{modalGift.name}"'
				saveText='Lagre'
				description='Skriv inn navnet ditt, som vises hvis andre prøver å fjerne avhukingen.'
				onConfirm={() => {
					if (!modalGift) {
						return;
					}
					modalGift.gifterName = normalizeName(inputGifterName);
					modalGift.claimed = true;
					applyModalUpdate(modalGift);
					closeModal();
				}}
				onClose={closeModal}
			>
				{#snippet children()}
					<label class="text-sm font-medium" for="inputGifterName">Navnet ditt</label>
					<Input
						id="inputGifterName"
						type="text"
						value={inputGifterName}
						oninput={(e: Event) => (inputGifterName = (e.currentTarget as HTMLInputElement).value)}
						placeholder={"Olga Nordmann"}
						required
					/>
				{/snippet}
			</CheckModal>

			<CheckModal  
				open={modalState == 'unchecked'}
				title='{modalGift.name} blir gitt av {modalGift.gifterName ?? 'ukjent giver'}'
                saveText='Jeg er {modalGift.gifterName ?? 'ukjent giver'}'
				description='Planlegger du å ikke gi denne gaven likevel? Trykk "Jeg er {modalGift.gifterName ?? 'ukjent giver'}". Hvis ikke trykk "Avbryt"'
				onConfirm={() => {
					if (!modalGift) {
						return;
					}
					modalGift.claimed = false;
					modalGift.gifterName = undefined;
					applyModalUpdate(modalGift);
					closeModal();
				}}
				onClose={closeModal}
			/>
		{/if}
	</div>
</SectionShell>
