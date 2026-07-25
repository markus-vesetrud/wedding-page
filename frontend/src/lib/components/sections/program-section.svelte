<script lang="ts">
	import SectionShell from '$lib/components/sections/section-shell.svelte';
	import SurfaceCard from '$lib/components/surface-card.svelte';

	const program = [
		{ time: '14:00', name: 'Vielse' },
		{ time: '15:00', name: 'Mingling' },
		{ time: '17:00', name: 'Selskap begynner' },
		{ time: '17:30', name: 'Middag' },
		{ time: '19:45', name: 'Pause' },
		{ time: '20:30', name: 'Kaffe og kaker' },
		{ time: '23:59', name: 'Dansegulvet stenges' }
	];
</script>

<SectionShell
	id="program"
	title="Program"
	ingress="Tentativt program, vil nok endres etter hvert. Sjekk igjen når det nærmer seg!"
>
	<SurfaceCard class="divide-y overflow-hidden">
		{#each program as item (item.time + item.name)}
			<div class="flex items-center gap-4 px-5 py-4">
				<span class="text-accent-foreground min-w-16 text-lg font-extrabold tracking-tight">{item.time}</span>
				<span class="text-base font-medium">{item.name}</span>
			</div>
		{/each}
	</SurfaceCard>
</SectionShell>
