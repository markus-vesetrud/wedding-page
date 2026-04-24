<script lang="ts">
	import { cn } from '$lib/utils';

	let { class: className = '', ...restProps } = $props();
</script>

<textarea
	data-slot="textarea"
	class={cn(
		'border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring/50 flex min-h-20 w-full rounded-md border px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
	{...restProps}
></textarea>
