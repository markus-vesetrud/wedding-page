<script lang="ts" generics="T extends { id: string }">
	import { flip } from 'svelte/animate';
	import type { Snippet } from 'svelte';

	let {
		items,
		isLoading,
		emptyText,
		loadingCount = 4,
		children
	}: {
		items: T[];
		isLoading: boolean;
		emptyText: string;
		loadingCount?: number;
		children?: Snippet<[T]>;
	} = $props();

    const element_style = "bg-card/85 rounded-lg border border-border/80 p-3";
</script>

<ul class="space-y-2">
	{#if isLoading && items.length === 0}
		{#each Array(loadingCount) as _, index (index)}
			<li>
				<div class="{element_style} animate-pulse"></div>
			</li>
		{/each}
	{:else if items.length === 0}
		<li class="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">{emptyText}</li>
	{:else}
		{#each items as item (item.id)}
			<li animate:flip class="{element_style}">
				{@render children?.(item)}
			</li>
		{/each}
	{/if}
</ul>
