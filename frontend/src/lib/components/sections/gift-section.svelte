<script lang="ts">
	import type { Gift } from '$shared/types';
	import { sortByCheckedAndUpdatedAt } from '$lib/item-sorting';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import SectionShell from '$lib/components/sections/section-shell.svelte';
	import AnimatedList from '$lib/components/sections/animated-list.svelte';

	let {
		gifts,
		isLoading,
		newGift,
		onNewGiftChange,
		onAddGift,
		onToggleGift
	}: {
		gifts: Gift[];
		isLoading: boolean;
		newGift: string;
		onNewGiftChange: (value: string) => void;
		onAddGift: () => void;
		onToggleGift: (id: string) => void;
	} = $props();

	const sortedGifts = $derived(sortByCheckedAndUpdatedAt(gifts));
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
							checked={gift.checked}
							onchange={() => onToggleGift(gift.id)}
							class="text-primary focus:ring-ring h-4 w-4 rounded border"
						/>
						<span class={gift.checked ? 'text-muted-foreground line-through' : ''}>{gift.name}</span>
					</label>
					<span class="text-muted-foreground text-xs">{gift.checked ? 'Reservert' : 'Ledig'}</span>
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
				/>
				<Button type="submit" class="min-w-28 whitespace-nowrap">Legg til</Button>
			</form>
	</div>
</SectionShell>
