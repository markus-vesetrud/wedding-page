<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		isLoading = false,
		itemClass = '',
		children
	}: {
		isLoading?: boolean;
		itemClass?: string;
		children?: Snippet;
	} = $props();
</script>

<li class={`bg-card/85 rounded-lg border border-border/80 p-3 ${isLoading ? 'animate-pulse' : ''} ${itemClass}`.trim()}>
	{#if !isLoading}
		{@render children?.()}
	{/if}
</li>
