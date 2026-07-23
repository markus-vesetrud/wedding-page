<script lang="ts">
    import type { Cake } from '$shared/types';
    import { sortByClaimedAndUpdatedAt } from '$lib/item-sorting';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
    import SectionShell from '$lib/components/sections/section-shell.svelte';
    import AnimatedList from '$lib/components/animated-list.svelte';
	import ReservableRow from '$lib/components/reservable-row.svelte';
	import CheckModal from '../check-modal.svelte';
	import { normalizeName } from '$lib/utils/capitalize';

	let {
		cakes,
        isLoading,
		newCake,
		onNewCakeChange,
		onAddCake,
        applyModalUpdate
	}: {
		cakes: Cake[];
        isLoading: boolean;
		newCake: string;
		onNewCakeChange: (value: string) => void;
		onAddCake: () => void;
		applyModalUpdate: (cake: Cake) => void;
	} = $props();

	type ModalState = 'closed' | 'checked' | 'unchecked';

	let modalState = $state<ModalState>('closed');
	let modalCake = $state<Cake | undefined>();
	let inputBakerName = $state('');

	function openCheckModal(cake: Cake) {
		modalState = 'checked';
		modalCake = cake;
		inputBakerName = '';
	}

	function openUncheckModal(cake: Cake) {
		modalState = 'unchecked';
		modalCake = cake;
		modalCake.bakerName ??= 'Ukjent gavegiver'
	}

	function closeModal() {
		modalState = 'closed';
		modalCake = undefined;
		inputBakerName = '';
	}

	function toggleCake(id: string) {
		const item = cakes.find((g) => g.id === id);
		if (!item) return;
		if (item.claimed) {
			openUncheckModal(item);
			return;
		}
		openCheckModal(item);
	}
    const sortedCakes = $derived(sortByClaimedAndUpdatedAt(cakes));
</script>

<SectionShell
    id="kaker"
    title="Kaker"
    ingress="Se hvem som baker hva og hvilke kaker vi fortsatt ønsker oss. Vi tar gjerne imot kakeforslag, de sendes til oss først, og dukker opp i lista om vi er enige"
>
    <div class="space-y-4">
        <AnimatedList items={sortedCakes} {isLoading} emptyText="Ingen kaker i listen ennå." loadingCount={4}>
            {#snippet children(cake)}
                <ReservableRow
                    claimed={cake.claimed}
                    label={cake.name}
                    statusText={cake.claimed ? `Bakes av ${cake.bakerName ?? 'Ukjent'}` : 'Ledig'}
                    onclick={() => toggleCake(cake.id)}
                />
            {/snippet}
        </AnimatedList>
        <form
            class="flex flex-col gap-3 sm:flex-row"
            onsubmit={(e) => {
                e.preventDefault();
                onAddCake();
            }}
        >
            <Input
                type="text"
                value={newCake}
                oninput={(e: Event) => onNewCakeChange((e.currentTarget as HTMLInputElement).value)}
                placeholder="Legg til kakeønske"
                required
            />
            <Button type="submit" class="min-w-28 whitespace-nowrap">Legg til</Button>
        </form>

        {#if modalCake !== undefined}
			<CheckModal  
				open={modalState == 'checked'}
				title='Før du reserverer "{modalCake.name}"'
                saveText='Reserver'
				description='Skriv inn navnet ditt - det vises i lista, slik at de andre ser hvilken innsats du legger inn for oss. Takk forresten!'
				onConfirm={() => {
					if (!modalCake) {
						return;
					}
					modalCake.bakerName = normalizeName(inputBakerName);
					modalCake.claimed = true;
					applyModalUpdate(modalCake);
					closeModal();
				}}
				onClose={closeModal}
			>
				{#snippet children()}
					<label class="text-sm font-medium" for="inputBakerName">Navnet ditt</label>
                    <Input
                        id="inputBakerName"
                        type="text"
                        value={inputBakerName}
                        oninput={(e: Event) => (inputBakerName = (e.currentTarget as HTMLInputElement).value)}
                        placeholder={"Olga Nordmann"}
                        required
                    />
				{/snippet}
			</CheckModal>

			<CheckModal  
				open={modalState == 'unchecked'}
				title='{modalCake.bakerName ?? 'Ukjent'} baker {modalCake.name} allerede'
                saveText='Jeg er {modalCake.bakerName ?? 'Ukjent'}'
				description='Planlegger du å ikke bake denne kaken likevel? Trykk "Jeg er {modalCake.bakerName ?? 'Ukjent'}". Hvis ikke trykk "Avbryt"'
				modalIsAbortNotConfirm
				onConfirm={() => {
					if (!modalCake) {
						return;
					}
					modalCake.claimed = false;
					modalCake.bakerName = undefined;
					applyModalUpdate(modalCake);
					closeModal();
				}}
				onClose={closeModal}
			/>
		{/if}
	</div>
</SectionShell>
