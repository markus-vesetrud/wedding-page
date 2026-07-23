<script lang="ts">
	import type { Gift } from '$shared/types';
	import { sortByClaimedAndUpdatedAt } from '$lib/item-sorting';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import SectionShell from '$lib/components/sections/section-shell.svelte';
	import AnimatedList from '$lib/components/animated-list.svelte';
	import ReservableRow from '$lib/components/reservable-row.svelte';
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
	ingress="Listen er kun forslag, laget for å unngå at flere gir det samme. Reserver gjerne noe - hvem som har reservert hva holdes skjult for de andre gjestene og brudeparret. Mangler noe? Legg det til nederst. Husk kvittering uansett ;D"
>
	<div class="space-y-3">
		<AnimatedList items={sortedGifts} {isLoading} emptyText="Ingen gaveønsker i listen ennå." loadingCount={4}>
			{#snippet children(gift)}
				<ReservableRow
					claimed={gift.claimed}
					label={gift.name}
					statusText={gift.claimed ? 'Reservert' : 'Ledig'}
					onclick={() => toggleGift(gift.id)}
				/>
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
			<Button type="submit" class="min-w-28 whitespace-nowrap bg-foreground">Legg til</Button>
		</form>

		{#if modalGift !== undefined}
			<CheckModal  
				open={modalState == 'checked'}
				title='Før du reserverer "{modalGift.name}"'
				saveText='Lagre'
				description='Skriv inn navnet ditt. Det vises kun hvis noen senere prøver å fjerne reservasjonen - de andre gjestene og brudeparet ser bare at den er reservert.'
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
						placeholder={"F. eks. Kåre Nordmann"}
						required
					/>
				{/snippet}
			</CheckModal>

			<CheckModal  
				open={modalState == 'unchecked'}
				title='{modalGift.gifterName ?? 'Ukjent'} gir {modalGift.name} allerede'
                saveText='Jeg er {modalGift.gifterName ?? 'Ukjent'}'
				description='Planlegger du å ikke gi denne gaven likevel? Trykk "Jeg er {modalGift.gifterName ?? 'Ukjent'}". Hvis ikke trykk "Avbryt"'
				modalIsAbortNotConfirm
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
