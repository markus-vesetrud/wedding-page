<script lang="ts">
	import { cn } from '$lib/utils';

	type ButtonVariant = 'default' | 'outline' | 'ghost';
	type ButtonType = 'button' | 'submit' | 'reset';

	let {
		class: className = '',
		variant = 'default' as ButtonVariant,
		type = 'button' as ButtonType,
		children,
		...restProps
	} = $props();

	const variantClasses: Record<string, string> = {
		default: 'bg-foreground text-primary-foreground hover:bg-foreground/90',
		outline: 'border bg-background hover:bg-accent hover:text-accent-foreground',
		ghost: 'hover:bg-accent hover:text-accent-foreground'
	};
</script>

<button
	{type}
	data-slot="button"
	class={cn(
		'inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
		variantClasses[variant] ?? variantClasses.default,
		className
	)}
	{...restProps}
>
	{@render children?.()}
</button>
