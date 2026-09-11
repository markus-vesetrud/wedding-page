<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		id,
		title,
		ingress,
		headingClass = 'font-serif text-3xl font-medium tracking-tight',
		tone = 'base',
		children
	}: {
		id: string;
		title: string;
		ingress?: string;
		headingClass?: string;
		tone?: 'base' | 'muted';
		children?: Snippet;
	} = $props();
</script>

<section
	{id}
	class={`border-t border-border ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] w-screen py-14 ${tone === 'muted' ? 'bg-muted' : 'bg-background'}`}
>
	<div class="mx-auto w-full max-w-2xl px-4 md:px-6">
		<div class="space-y-3">
			<h2 class={headingClass}>{title}</h2>
			{#if ingress}
				<p class="text-muted-foreground text-sm leading-relaxed">{ingress}</p>
			{/if}
		</div>

		<div class="mt-6">
			{@render children?.()}
		</div>
	</div>
</section>
