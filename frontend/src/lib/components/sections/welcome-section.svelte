<script lang="ts">
	import Countdown from "../countdown.svelte";

	let {
		invitationId = '',
		isMainPage = true
	}: {
		invitationId?: string;
		isMainPage?: boolean;
	} = $props();

	const backToInvitationHref = $derived(
		invitationId ? `/invitasjon/${encodeURIComponent(invitationId)}` : ''
	);
</script>

<section id="velkommen" class="pt-5 {isMainPage ? 'pb-20' : 'pb-10'}">
	{#if isMainPage && invitationId}
		<div class="mb-3">
			<a
				href={backToInvitationHref}
				class="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
			>
				← Tilbake til invitasjon
			</a>
		</div>
	{/if}

	<div
		class="relative my-4 overflow-hidden rounded-xl bg-cover bg-center bg-no-repeat"
		style="background-image: url('https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=80');"
	>
		<div class="absolute inset-0 bg-black/35"></div>
		<div class="relative z-10 flex min-h-[60svh] flex-col justify-end gap-4 p-6 md:p-8">
			<h1 class="inline-flex w-fit flex-col border-2 border-white px-4 py-3 text-white">
				<span class="text-2xl font-semibold tracking-tight md:text-3xl">Velkommen til</span>
				<span class="text-3xl font-semibold tracking-tight md:text-5xl">Malin og Markus</span>
				<span class="text-2xl font-semibold tracking-tight md:text-3xl">sitt bryllup</span>
			</h1>
		</div>
	</div>

	<Countdown />
</section>