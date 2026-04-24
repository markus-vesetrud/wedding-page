<script lang="ts">
	import { cn } from '$lib/utils';

	let { class: className = '', children, ...restProps } = $props();
</script>

<div data-slot="card-header" class={cn('space-y-1.5', className)} {...restProps}>
	{@render children?.()}
</div>
