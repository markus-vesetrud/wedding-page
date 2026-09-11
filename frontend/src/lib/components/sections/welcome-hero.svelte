<script lang="ts">
	import Countdown from "../countdown.svelte";
	import coverPhoto from "$lib/assets/atumn-walking-square.jpg";

	let {
		showCountDown
	}: {
		showCountDown?: boolean;
	} = $props();
</script>

<section id="velkommen">
	<div class="relative mb-4 ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] w-screen">
		<div
			class="hero-frame relative mx-auto overflow-hidden bg-cover bg-[center_35%] bg-no-repeat"
			style="background-image: url({coverPhoto});"
		>
			<div
				class="absolute inset-0 bg-gradient-to-t from-foreground/75 via-foreground/25 to-foreground/10"
			></div>
			<div class="hero-content relative z-10 flex flex-col items-center justify-end p-8 text-center">
				<h1 class="inline-flex w-fit flex-col font-serif text-white">
					<span class="hero-title-sm leading-tight tracking-tight italic text-white/90">Velkommen til</span>
					<span class="hero-title-lg leading-tight tracking-tight">Malin & Markus</span>
					<div class="hero-rule mx-auto my-3 h-px w-32 bg-[#c7ae76]"></div>
					<span class="hero-title-sm leading-tight tracking-tight italic text-white/90">sitt bryllup</span>
				</h1>
			</div>
		</div>
	</div>

	<p class="my-4 text-center font-serif text-2xl font-medium tracking-tight md:text-3xl">Lørdag 31. juli 2027</p>

	{#if showCountDown}
		<Countdown />
	{/if}
</section>

<style>
	.hero-frame {
		max-width: 100%;
	}

	/*
	 * Stay full-bleed on normal HD screens (up to 1920x1080). Cap the width
	 * once the viewport is wider than that, or once it's 1920 wide but
	 * shorter than 1080 (aspect ratio wider than 16:9) — either case means
	 * the image would otherwise stretch too wide relative to its height.
	 */
	@media (min-width: 1921px), (min-aspect-ratio: 1921/1080) {
		.hero-frame {
			max-width: 1920px;
		}
	}

	/*
	 * Only round the corners once the width cap above is actually shrinking
	 * the box below the viewport's width (i.e. viewport wider than 1920px) —
	 * the aspect-ratio-only case can trigger the cap while it's still a
	 * no-op (viewport <=1920px wide), which should stay flush/square. Only
	 * the bottom corners round; the top stays flush with the image above it.
	 */
	@media (min-width: 1921px) {
		.hero-frame {
			border-bottom-left-radius: var(--radius-xl);
			border-bottom-right-radius: var(--radius-xl);
		}
	}

	.hero-content {
		/* Width the box actually renders at, matching the max-width cap above. */
		--hero-w: min(100vw, 1920px);

		/*
		 * Continuous fluid target: rises smoothly from ~60svh at 1280px wide
		 * to ~80svh at 1920px wide (calibrated against a ~1080px-tall
		 * reference screen), instead of jumping between fixed breakpoints.
		 */
		--hero-fluid: calc(60vw - 288px);

		/* Keep the box's aspect ratio (width / height) within [0.60, 2.25]. */
		--hero-ratio-floor: max(60svh, calc(var(--hero-w) / 2.25));
		--hero-ratio-ceiling: min(80svh, calc(var(--hero-w) / 0.6));

		min-height: clamp(var(--hero-ratio-floor), var(--hero-fluid), var(--hero-ratio-ceiling));
	}

	/*
	 * Fluid heading sizes: scale continuously with the hero box's own
	 * rendered width (--hero-w, inherited from .hero-content — already
	 * clamped to 1920px), not the raw viewport, so the text tracks the
	 * image size itself and stays flat once the image stops growing.
	 * Calibrated so ~360px wide lands around text-3xl/4xl and ~1920px wide
	 * lands around text-7xl/8xl; the clamp() floor covers narrower cases.
	 */
	.hero-title-sm {
    	font-size: clamp(1.875rem, calc(var(--hero-w) * 0.026923 + 20.308px), 4.5rem);
	}

	.hero-title-lg {
    	font-size: clamp(2.25rem, calc(var(--hero-w) * 0.038462 + 22.154px), 6rem);
	}
</style>
