<script lang="ts">
	import { cn } from '$lib/utils';
	import SurfaceCard from '$lib/components/surface-card.svelte';

	let { class: className = '', children, ...restProps } = $props();
</script>

<SurfaceCard
	data-slot="card"
	class={cn('text-card-foreground flex flex-col gap-5 p-6', className)}
	{...restProps}
>
	{@render children?.()}
</SurfaceCard>
