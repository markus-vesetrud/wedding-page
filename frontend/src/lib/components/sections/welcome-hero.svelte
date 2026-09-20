<script lang="ts">
	import Countdown from "../countdown.svelte";
	import autumnPhoto from "$lib/assets/atumn-walking-square.jpg";
	import canariaPhoto from "$lib/assets/gran-canaria-portrait-square.jpg";

	let {
		showCountDown,
		showCeremonyLine = false,
		photo = 'autumn',
		dark = false,
		tintStrength = 1,
	}: {
		showCountDown?: boolean;
		showCeremonyLine?: boolean;
		photo?: 'autumn' | 'canaria';
		dark?: boolean;
		/** Multiplier on the overlay's alpha stops — turn up if a particular photo still reads too washed-out, down if it feels too heavy. */
		tintStrength?: number;
	} = $props();

	const coverPhoto = $derived(photo === 'canaria' ? canariaPhoto : autumnPhoto);
</script>

<section id="velkommen" class="mb-8">
	<div class="relative ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] w-screen mb-2">
		<div
			class="hero-frame relative mx-auto overflow-hidden bg-cover bg-[center_35%] bg-no-repeat"
			style="background-image: url({coverPhoto});"
		>
			<div class={`hero-tint absolute inset-0 ${dark ? 'hero-tint-light' : 'hero-tint-dark'}`} style={`--tint-strength: ${tintStrength};`}></div>
			<div class="hero-bottom-fade absolute inset-x-0 bottom-0"></div>
			<div class="hero-content relative z-10 flex flex-col items-center justify-end pb-16 text-center">
				<h1 class={`hero-text inline-flex w-fit flex-col font-serif ${dark ? 'text-foreground' : 'text-background'}`}>
					<span class="hero-title-lg leading-tight tracking-tight">Malin & Markus</span>
					<div class={`hero-rule mx-auto my-3 h-px w-32 ${dark ? 'bg-[#7A6A43]/70' : 'bg-[#c7ae76]'}`}></div>
					<span class={`hero-title-sm leading-tight tracking-tight italic ${dark ? 'text-[#7A6A43]' : 'text-[#c7ae76]'}`}>gifter seg</span>
				</h1>
				<p class={`hero-date mt-3 font-serif leading-tight ${dark ? 'text-foreground' : 'text-background'}`}>
					Lørdag 31. juli 2027
				</p>
			</div>
		</div>
	</div>

	{#if showCeremonyLine}
		<p class="text-center text-sm font-medium">Vielse kl. 14:00 · Nittedal kirke</p>
	{/if}

	{#if showCountDown}
		<Countdown />
	{/if}
</section>

<style>
	.hero-frame {
		/*
		 * ===== Tunable hero size knobs — edit these three, nothing else =====
		 * --hero-target-svh : the height the hero *wants* to be, at full width.
		 * --hero-min-ratio  : narrowest allowed width/height. Too tall/narrow
		 *                     (below this) shrinks the height instead.
		 * --hero-max-ratio  : widest allowed width/height. Too wide/short
		 *                     (above this) caps the width instead.
		 */
		--hero-target-svh: 85svh;
		--hero-min-ratio: 0.8;
		--hero-max-ratio: 2.1;
		/* ===================================================================== */

		/* Step 1: shrink the target height if a full-width box would be too tall/narrow. */
		--hero-h: min(var(--hero-target-svh), calc(100vw / var(--hero-min-ratio)));

		/* Step 2: cap the width if a box at that height would be too wide/short. */
		--hero-w: min(100vw, calc(var(--hero-h) * var(--hero-max-ratio)));

		max-width: var(--hero-w);
	}

	/*
	 * Round the bottom corners whenever the width cap above is actually
	 * shrinking the box below full viewport width — a flush full-bleed box
	 * should stay square. There's no way to branch on a calc() result in
	 * plain CSS, so approximate it with the aspect ratio at which the cap
	 * kicks in for a full-height (unclamped) hero: width/height > max-ratio,
	 * i.e. roughly vw/vh > max-ratio * 0.85 (the target-svh fraction). Only
	 * the bottom corners round; the top stays flush with the image above it.
	 */
	@media (min-aspect-ratio: 1913/1000) {
		.hero-frame {
			border-bottom-left-radius: var(--radius-xl);
			border-bottom-right-radius: var(--radius-xl);
		}
	}

	/*
	 * The photo tint. A CSS linear-gradient (unlike the PDF's drawing API)
	 * natively supports per-stop alpha, so this is just four rgba() stops —
	 * no banding workaround needed. Stops are listed bottom-to-top (matching
	 * `to top`, and the `--tint-a-*` naming) since that's where the text
	 * sits and needs the most contrast.
	 *
	 * `--tint-strength` (the `tintStrength` prop, default 1) scales every
	 * alpha stop uniformly — bump it per-usage if a specific photo still
	 * reads too washed out (e.g. a bright sky/sand shot) or feels too heavy.
	 * To restyle the curve itself (not just its intensity), edit the
	 * `--tint-a-*` values below.
	 */
	.hero-tint {
		--tint-a-bottom: 0.8;
		--tint-a-low: 0.55;
		--tint-a-mid: 0.22;
		--tint-a-top: 0.04;
	}

	.hero-tint-dark {
		/* Dark green tint, for white text (the default / non-`dark` variant). */
		--tint-rgb: 33 28 20;
		--tint-rgb-mid: 20 34 25;
		--tint-rgb-top: 20 29 33;
	}

	.hero-tint-light {
		/*
		 * Pale cream tint, for dark text (the `dark` variant) — needs a
		 * noticeably higher base strength than the dark tint above since it's
		 * fighting bright, sunlit photos rather than darkening them. The top
		 * half fades to almost nothing (0.10 by 55%, 0.02 at the very top) —
		 * this variant currently has no content up there, so the photo should
		 * read essentially untinted.
		 */
		--tint-a-bottom: 0.80;
		--tint-a-low: 0.60;
		--tint-a-mid: 0.00;
		--tint-a-top: 0.15;
		--tint-rgb: 242 245 239;
		--tint-rgb-mid: 242 245 239;
		--tint-rgb-top: 21 60 107;
	}

	.hero-tint {
		background: linear-gradient(
			to top,
			rgb(var(--tint-rgb) / clamp(0, calc(var(--tint-a-bottom) * var(--tint-strength)), 1)) 0%,
			rgb(var(--tint-rgb) / clamp(0, calc(var(--tint-a-low) * var(--tint-strength)), 1)) 25%,
			rgb(var(--tint-rgb-mid) / clamp(0, calc(var(--tint-a-mid) * var(--tint-strength)), 1)) 50%,
			rgb(var(--tint-rgb-top) / clamp(0, calc(var(--tint-a-top) * var(--tint-strength)), 1)) 100%
		);
	}

	/*
	 * Dissolves the photo's bottom edge into the page background instead of
	 * cutting off sharply. Fixed height (not tied to hero-w), sized to clear
	 * the hero-content's own bottom padding (this project's root font-size is
	 * 20px, so p-8 = 2rem = 40px) with a small buffer, so it only ever
	 * occupies the empty gap below the lowest on-image text (the date, when
	 * `dateOnImage` is set) — never fades over the text itself. Kept short:
	 * the photo tint is quite dark there already, so it doesn't take much
	 * fade distance to reach the (much lighter) page background — a tall
	 * fade just reads as an odd glow.
	 */
	.hero-bottom-fade {
		height: 50px;
		background: linear-gradient(to bottom, transparent, var(--background));
		pointer-events: none;
	}
	
	.hero-content {
		/* --hero-w / --hero-h are set on .hero-frame above and inherited here. */
		min-height: var(--hero-h);
	}

	.hero-title-sm {
		/* Growth slowed down (per design feedback): 1920px -> 30px, 375px -> 18px (unchanged). */
		font-size: clamp(1.0rem, calc(var(--hero-w) * 0.0135 + 16px), 2.0rem);
	}

	.hero-title-lg {
		/* Growth slowed down (per design feedback): 1920px -> 72px, 375px -> 30px (unchanged). */
		font-size: clamp(1.5rem, calc(var(--hero-w) * 0.040 + 20px), 4.5rem);
	}

	/* Same pivoting scale as the titles above; sized between hero-title-sm and hero-title-lg. */
	.hero-date {
		/* Growth slowed down (per design feedback): 1920px -> 48px, 375px -> 20px (unchanged). */
		font-size: clamp(1.25rem, calc(var(--hero-w) * 0.030 + 18px), 3.5rem);
	}
</style>
