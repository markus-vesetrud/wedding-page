<script lang="ts">
	import { cn } from '$lib/utils';

	let { class: className = '', children, ...restProps } = $props();
</script>

<div
	data-slot="card"
	class={cn('bg-card text-card-foreground flex flex-col gap-5 rounded-2xl border p-6 shadow-sm', className)}
	{...restProps}
>
	{@render children?.()}
</div>
