<script lang="ts">
	import { cn } from '$lib/utils';

	let { class: className = '', children, ...restProps } = $props();
</script>

<div data-slot="card-content" class={cn('space-y-4', className)} {...restProps}>
	{@render children?.()}
</div>
