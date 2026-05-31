<script lang="ts">
	import type { Gift } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import SectionShell from '$lib/components/sections/section-shell.svelte';
	import ListItem from '$lib/components/sections/list-item.svelte';

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
</script>

<SectionShell
	id="gaver"
	title="Gaveliste"
	ingress="Denne listen er kun et forslag, og er laget for å unngå duplikate gaver. Hvis du vil gi noe annet enn det som står her, kan du legge til et nytt forslag."
>
	<div class="space-y-3">
		<ul class="space-y-2">
			{#if isLoading && gifts.length === 0}
				{#each Array(4) as _, index (index)}
					<ListItem isLoading />
				{/each}
			{:else if gifts.length === 0}
				<li class="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">Ingen gaveønsker i listen ennå.</li>
			{:else}
				{#each gifts as gift (gift.id)}
					<ListItem itemClass="flex items-center justify-between">
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
					</ListItem>
				{/each}
			{/if}
		</ul>
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
