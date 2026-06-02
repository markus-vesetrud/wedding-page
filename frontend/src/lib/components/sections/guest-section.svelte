<script lang="ts">
	import type { Guest } from '$shared/types';
	import { Attendance } from '$shared/types';
	import SectionShell from '$lib/components/sections/section-shell.svelte';
	import AnimatedList from '$lib/components/sections/animated-list.svelte';

	let {
		guests,
		isLoading
	}: {
		guests: Guest[];
		isLoading: boolean;
	} = $props();


</script>

<SectionShell id="gjester" title="Gjesteliste" ingress="Oversikt over gjestene som er invitert." includeMarginBottom={false}>
	<div class="space-y-4">
		<AnimatedList items={guests} {isLoading} emptyText="Ingen gjester i listen ennå." loadingCount={4}>
			{#snippet children(guest)}
				{@const isAttending = guest.attendance === Attendance.Attending}
				<div class="flex items-center justify-between">
					<span class={`inline-flex h-4 min-w-4 items-center justify-center rounded border px-1 text-[10px] ${isAttending ? 'border-primary text-primary' : 'text-muted-foreground border-muted-foreground/40'}`}>
						{isAttending ? '✓' : '–'}
					</span>
					<span class={isAttending ? 'text-muted-foreground line-through' : ''}>{guest.name}</span>
					<span class="text-muted-foreground text-xs">{guest.attendance}</span>
				</div>
			{/snippet}
		</AnimatedList>
	</div>
</SectionShell>
