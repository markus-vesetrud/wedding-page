<script lang="ts">
	import type { Gift } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	let {
		gifts,
		newGift,
		onNewGiftChange,
		onAddGift,
		onToggleGift
	}: {
		gifts: Gift[];
		newGift: string;
		onNewGiftChange: (value: string) => void;
		onAddGift: () => void;
		onToggleGift: (id: string) => void;
	} = $props();
</script>

<section id="gaver" class="scroll-mt-20 py-8 md:py-10">
	<div class="space-y-4">
		<h2 class="text-2xl font-semibold tracking-tight">Gaveliste</h2>
		<p class="text-muted-foreground text-sm leading-relaxed">
			Denne listen er kun et forslag, og er laget for å unngå duplikate gaver. Hvis du vil gi noe annet enn det som står her, kan du legge til et nytt forslag.
		</p>
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
				<Button type="submit">Legg til</Button>
			</form>

			<ul class="space-y-2">
				{#each gifts as gift (gift.id)}
					<li class="bg-muted/60 flex items-center justify-between rounded-lg border p-3">
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
					</li>
				{/each}
			</ul>
	</div>
</section>
