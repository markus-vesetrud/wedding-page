<script lang="ts">
	import { cn } from '$lib/utils';

	let { class: className = '', children, ...restProps } = $props();
</script>

<p data-slot="card-description" class={cn('text-muted-foreground text-sm leading-relaxed', className)} {...restProps}>
	{@render children?.()}
</p>
