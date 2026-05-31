<script lang="ts">
	import type { Guest } from '$lib/types';
	import SectionShell from '$lib/components/sections/section-shell.svelte';
	import ListItem from '$lib/components/sections/list-item.svelte';

	let {
		guests,
		isLoading
	}: {
		guests: Guest[];
		isLoading: boolean;
	} = $props();


</script>

<SectionShell id="gjester" title="Gjesteliste" ingress="Oversikt over gjestene som er invitert.">
	<div class="space-y-4">
		<ul class="space-y-2">
			{#if isLoading && guests.length === 0}
				{#each Array(4) as _, index (index)}
					<ListItem isLoading />
				{/each}
			{:else if guests.length === 0}
				<li class="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">Ingen gjester i listen ennå.</li>
			{:else}
				{#each guests as guest (guest.id)}
					<ListItem itemClass="flex items-center justify-between">
						<span class={`inline-flex h-4 min-w-4 items-center justify-center rounded border px-1 text-[10px] ${guest.checked ? 'border-primary text-primary' : 'text-muted-foreground border-muted-foreground/40'}`}>
							{guest.checked ? '✓' : '–'}
						</span>
						<span class={guest.checked ? 'text-muted-foreground line-through' : ''}>{guest.name}</span>
						<span class="text-muted-foreground text-xs">{guest.checked ? 'Kommer' : 'Ikke bekreftet'}</span>
					</ListItem>
				{/each}
			{/if}
		</ul>
	</div>
</SectionShell>
