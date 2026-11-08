<script lang="ts">
	import type { Snippet } from 'svelte';

	// A large lead word next to a paragraph, separated by a divider line.
	// Side by side with a vertical line on wide viewports,
	// stacked with a horizontal line on narrow ones.
	let {
		lead,
		class: className = '',
		leadClass = 'font-serif text-2xl font-medium tracking-tight text-accent',
		children
	}: {
		lead: string;
		class?: string;
		leadClass?: string;
		children?: Snippet;
	} = $props();
</script>

<div class={`flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-5 ${className}`}>
	<p class={`shrink-0 ${leadClass}`}>{lead}</p>
	<p class="text-muted-foreground text-md leading-relaxed">
		{@render children?.()}
	</p>
</div>
