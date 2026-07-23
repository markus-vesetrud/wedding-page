<script lang="ts">
	let {
		claimed,
		label,
		statusText,
		onclick
	}: {
		claimed: boolean;
		label: string;
		statusText: string;
		onclick: () => void;
	} = $props();

	let statusEl: HTMLSpanElement | undefined = $state();
	let isTruncated = $state(false);

	$effect(() => {
		statusText;
		const el = statusEl;
		if (!el) return;

		const check = () => {
			isTruncated = el.scrollHeight > el.clientHeight + 1;
		};
		check();

		const resizeObserver = new ResizeObserver(check);
		resizeObserver.observe(el);
		return () => resizeObserver.disconnect();
	});
</script>

<button
	type="button"
	{onclick}
	class={`flex w-full items-center gap-3 rounded-lg border py-2 px-3 text-left transition-colors hover:border-muted-foreground-subtle/40 ${claimed ? 'bg-muted/100 hover:bg-muted/50' : 'bg-card hover:bg-card/50'}`}
>
	<span
		class={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold text-background border-muted-foreground-subtle/40 ${claimed && 'bg-emerald-600'}`}
	>
		{#if claimed}✓{/if}
	</span>
	<span class={`min-w-0 truncate font-semibold ${claimed ? 'text-muted-foreground-subtle line-through' : ''}`}>{label}</span>
	<span
		bind:this={statusEl}
		class={`status-clamp grid min-w-0 flex-1 items-center text-right text-xs font-bold ${isTruncated ? 'status-fade' : ''} ${claimed ? 'text-muted-foreground-subtle' : 'text-emerald-600'}`}
	>
		{statusText}
	</span>
</button>

<style>
	.status-clamp {
		/* Clip to exactly 2 lines of text-xs (1.0rem line-height each). */
		height: 2rem;
		overflow: hidden;
	}

	.status-fade {
		/* Only applied when the measured content actually overflows 2 lines,
		   so the fade never covers text that fully fits. */
		mask-image: linear-gradient(to bottom, black calc(100% - 0.45rem), transparent 100%);
		-webkit-mask-image: linear-gradient(to bottom, black calc(100% - 0.45rem), transparent 100%);
	}
</style>
