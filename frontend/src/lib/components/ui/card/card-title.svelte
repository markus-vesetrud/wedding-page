<script lang="ts">
	import { cn } from '$lib/utils';

	let { class: className = '', children, ...restProps } = $props();
</script>

<h2 data-slot="card-title" class={cn('font-serif text-2xl font-medium tracking-tight', className)} {...restProps}>
	{@render children?.()}
</h2>
