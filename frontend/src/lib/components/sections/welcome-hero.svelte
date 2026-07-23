<script lang="ts">
	import Countdown from "../countdown.svelte";

	let {
		showCountDown
	}: {
		showCountDown?: boolean;
	} = $props();
</script>

<section id="velkommen" class="pt-5">
	<div
		class="relative my-4 overflow-hidden rounded-xl bg-cover bg-center bg-no-repeat"
		style="background-image: url('https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=80');"
	>
		<div class="absolute inset-0 bg-black/35"></div>
		<div class="relative z-10 flex min-h-[60svh] flex-col justify-end gap-4 p-6 md:p-8">
			<h1 class="inline-flex w-fit flex-col text-white">
				<span class="text-2xl font-semibold tracking-tight md:text-3xl">Velkommen til</span>
				<span class="text-3xl font-semibold tracking-tight md:text-5xl">Malin og Markus</span>
				<span class="text-2xl font-semibold tracking-tight md:text-3xl">sitt bryllup</span>
			</h1>
		</div>
	</div>

	<p class="my-4 text-center text-xl font-bold tracking-tight md:text-2xl">Lørdag 31. juli 2027</p>

	{#if showCountDown}
		<Countdown />
	{/if}
</section>
