<script lang="ts">
    import type { Cake } from '$shared/types';
    import { sortByClaimedAndUpdatedAt } from '$lib/item-sorting';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
    import SectionShell from '$lib/components/sections/section-shell.svelte';
    import AnimatedList from '$lib/components/animated-list.svelte';
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
    title="Kakeoversikt"
    ingress="Se hvem som baker hva, hvilke kaker vi fortsatt ønsker oss, og legg gjerne til flere kakeforslag."
>
    <div class="space-y-4">
        <AnimatedList items={sortedCakes} {isLoading} emptyText="Ingen kaker i listen ennå." loadingCount={4}>
            {#snippet children(cake)}
                <div class="flex items-center justify-between">
                    <label class="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={cake.claimed}
                            onclick={(e) => {
								e.preventDefault();
								toggleCake(cake.id);
							}}
                            class="text-primary focus:ring-ring h-4 w-4 rounded border"
                        />
                        <span class={cake.claimed ? 'text-muted-foreground line-through' : ''}>{cake.name}</span>
                    </label>
                    <span class="text-muted-foreground text-xs">{cake.claimed ? (cake.bakerName ?? 'Baker') : ''}</span>
                </div>
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
				title='Før du huker av "{modalCake.name}"'
                saveText='Lagre'
				description='Skriv inn navnet ditt, som vises hvis andre prøver å fjerne avhukingen.'
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
				title='{modalCake.name} blir bakt av {modalCake.bakerName ?? 'ukjent baker'}'
                saveText='Jeg er {modalCake.bakerName ?? 'ukjent baker'}'
				description='Planlegger du å ikke gi bake denne kaka likevel? Trykk "Jeg er {modalCake.bakerName ?? 'ukjent baker'}". Hvis ikke trykk "Avbryt"'
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
