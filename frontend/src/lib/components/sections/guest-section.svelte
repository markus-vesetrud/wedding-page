<script lang="ts">
	import type { Guest } from '$shared/types';
	import { Attendance } from '$shared/types';
	import SectionShell from '$lib/components/sections/section-shell.svelte';
	import AnimatedList from '$lib/components/animated-list.svelte';

	let {
		guests,
		isLoading
	}: {
		guests: Guest[];
		isLoading: boolean;
	} = $props();


</script>

<SectionShell id="gjester" title="Gjesteliste" ingress="Oversikt over gjestene som er invitert.">
	<div class="space-y-4">
		<AnimatedList items={guests} {isLoading} emptyText="Ingen gjester i listen ennå." loadingCount={4}>
			{#snippet children(guest)}
				{@const isAttending = guest.attendance === Attendance.Attending}
				<div class="flex min-h-[60px] w-full items-center gap-3 rounded-xl border bg-card p-4">
					<span class={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold text-background ${isAttending ? 'border-foreground bg-foreground' : 'border-muted-foreground-subtle/40'}`}>
						{#if isAttending}✓{/if}
					</span>
					<span class="flex-1 font-semibold">{guest.name}</span>
					<span class="text-muted-foreground-subtle text-xs font-bold">{guest.attendance}</span>
				</div>
			{/snippet}
		</AnimatedList>
	</div>
</SectionShell>
