<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		id,
		title,
		ingress = '',
		headingClass = 'text-2xl font-semibold tracking-tight',
		includeMarginBottom = true,
		children
	}: {
		id: string;
		title: string;
		ingress?: string;
		headingClass?: string;
		includeMarginBottom?: boolean;
		children?: Snippet;
	} = $props();
</script>

<section {id} class="pt-0 {includeMarginBottom && 'mb-40'}">
	<div class="space-y-3">
		<h2 class={headingClass}>{title}</h2>
		{#if ingress}
			<p class="text-muted-foreground text-sm leading-relaxed">{ingress}</p>
		{/if}
	</div>

	<div class="mt-6">
		{@render children?.()}
	</div>
</section>
