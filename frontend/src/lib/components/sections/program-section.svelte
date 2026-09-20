<script lang="ts">
	import SectionShell from '$lib/components/sections/section-shell.svelte';
	import SurfaceCard from '$lib/components/surface-card.svelte';

	const program = [
		{ time: '14:00', name: 'Vielse' },
		{ time: '15:00', name: 'Mingling og snacks' },
		{ time: '17:00', name: 'Selskap begynner' },
		{ time: '17:30', name: 'Middag' },
		{ time: '19:45', name: 'Pause' },
		{ time: '20:30', name: 'Kaffe og kaker' }
	];
</script>

<SectionShell
	id="program"
	title="Program"
	ingress="Endringer kan skje, sjekk igjen når det nærmer seg"
	tone="muted"
>
	<SurfaceCard class="divide-y overflow-hidden">
		{#each program as item (item.time + item.name)}
			<div class="flex items-center gap-4 px-5 py-4">
				<span class="text-accent min-w-16 font-serif text-xl font-medium tracking-tight">{item.time}</span>
				<span class="text-base font-medium">{item.name}</span>
			</div>
		{/each}
	</SurfaceCard>
</SectionShell>
