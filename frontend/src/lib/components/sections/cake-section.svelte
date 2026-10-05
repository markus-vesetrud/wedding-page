<script lang="ts">
    import type { Cake } from '$shared/types';
    import { sortByClaimedAndUpdatedAt } from '$lib/item-sorting';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
    import SectionShell from '$lib/components/sections/section-shell.svelte';
    import AnimatedList from '$lib/components/animated-list.svelte';
	import ReservableRow from '$lib/components/reservable-row.svelte';
	import CheckModal from '../check-modal.svelte';
	import { captalize, normalizeName } from '$lib/utils/capitalize';

	let {
		cakes,
        isLoading,
		newCake,
		onNewCakeChange,
		onAddCake,
		cakeSuggestionSubmitted,
        applyModalUpdate
	}: {
		cakes: Cake[];
        isLoading: boolean;
		newCake: string;
		onNewCakeChange: (value: string) => void;
		onAddCake: (name: string, bakerName?: string) => void;
		cakeSuggestionSubmitted: boolean;
		applyModalUpdate: (cake: Cake) => void;
	} = $props();

	type ModalState = 'closed' | 'adding' | 'checked' | 'unchecked';

	let modalState = $state<ModalState>('closed');
	let modalCake = $state<Cake | undefined>();
	let inputBakerName = $state('');
	let pendingCakeName = $state('');
	let willBakeMyself = $state<boolean | null>(null);

	function openAddModal() {
		const name = captalize(newCake.trim());
		if (!name) return;
		pendingCakeName = name;
		inputBakerName = '';
		willBakeMyself = null;
		modalState = 'adding';
	}

	function selectWillBakeMyself(value: boolean) {
		willBakeMyself = value;
		if (!value) inputBakerName = '';
	}

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
		pendingCakeName = '';
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
    ingress="Se hvem som baker hva og hvilke kaker vi fortsatt ønsker oss"
>
    <div class="space-y-4">
        <AnimatedList items={sortedCakes} {isLoading} emptyText="Ingen kaker i listen ennå." loadingCount={4}>
            {#snippet children(cake)}
                <ReservableRow
                    claimed={cake.claimed}
                    label={cake.name}
                    statusText={cake.claimed ? `${cake.bakerName ?? 'Ukjent'}` : 'Ledig'}
                    onclick={() => toggleCake(cake.id)}
                />
            {/snippet}
        </AnimatedList>
        <p>
            Lyst på noe mer? Vi tar gjerne imot kakeforslag, de sendes til oss først, og dukker opp i lista om vi er enige :D
        </p>
        <form
            class="flex flex-col gap-3 sm:flex-row"
            onsubmit={(e) => {
                e.preventDefault();
                openAddModal();
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
        {#if cakeSuggestionSubmitted}
            <p class="text-foreground text-md font-semibold">
                ✓ Takk for kakeforslaget!
            </p>
        {/if}

        <CheckModal
            open={modalState == 'adding'}
            title='Legg til "{pendingCakeName}"'
            saveText="Legg til"
            description="Baker du denne selv?"
            onConfirm={() => {
                const bakerName = willBakeMyself && inputBakerName.trim() ? normalizeName(inputBakerName) : undefined;
                onAddCake(pendingCakeName, bakerName);
                closeModal();
            }}
            onClose={closeModal}
        >
            {#snippet children()}
                <div class="mb-3 flex gap-2">
                    <label class="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-md font-semibold {willBakeMyself === false ? 'border-accent bg-muted text-foreground' : 'border-input bg-background text-muted-foreground hover:border-accent'}">
                        <input
                            type="radio"
                            name="cakeWillBakeMyself"
                            class="sr-only"
                            required
                            checked={willBakeMyself === false}
                            onchange={() => selectWillBakeMyself(false)}
                        />
                        Nei
                    </label>
                    <label class="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-md font-semibold {willBakeMyself === true ? 'border-accent bg-muted text-foreground' : 'border-input bg-background text-muted-foreground hover:border-accent'}">
                        <input
                            type="radio"
                            name="cakeWillBakeMyself"
                            class="sr-only"
                            checked={willBakeMyself === true}
                            onchange={() => selectWillBakeMyself(true)}
                        />
                        Ja
                    </label>
                </div>
                <label class="text-md font-medium" for="inputAddBakerName">Navnet ditt</label>
                <Input
                    id="inputAddBakerName"
                    type="text"
                    value={inputBakerName}
                    oninput={(e: Event) => (inputBakerName = (e.currentTarget as HTMLInputElement).value)}
                    placeholder={"F. eks. Olga Nordmann"}
                    disabled={!willBakeMyself}
                    required={willBakeMyself === true}
                />
            {/snippet}
        </CheckModal>

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
					<label class="text-md font-medium" for="inputBakerName">Navnet ditt</label>
                    <Input
                        id="inputBakerName"
                        type="text"
                        value={inputBakerName}
                        oninput={(e: Event) => (inputBakerName = (e.currentTarget as HTMLInputElement).value)}
                        placeholder={"F. eks. Olga Nordmann"}
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
