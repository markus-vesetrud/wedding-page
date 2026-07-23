<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	let {
		class: className = '',
		children,
		...restProps
	}: { class?: string; children?: Snippet } & Record<string, unknown> = $props();
</script>

<div data-slot="surface-card" class={cn('rounded-xl border bg-card shadow-sm', className)} {...restProps}>
	{@render children?.()}
</div>
