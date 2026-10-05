<script lang="ts">
	import SectionShell from '$lib/components/sections/section-shell.svelte';
	import SurfaceCard from '$lib/components/surface-card.svelte';
	import Card from '../ui/card/card.svelte';
</script>

<SectionShell
	id="taler"
	title="Taler og underholdning"
	ingress="Vil du holde en tale eller et innsalg? Så gøy, det setter vi stor pris på! Ta kontakt med en av våre toastmastere"
>
	<div class="space-y-4">
		<div>
			<h3 class="text-accent mb-3 text-sm font-semibold tracking-widest uppercase">Kontaktinformasjon toastmastere</h3>
			<div class="grid gap-4 sm:grid-cols-2">
				<Card class="p-4">
					<p class="text-muted-foreground text-sm leading-relaxed">
						Kristin Marén Weider Grimstad<br />
						<strong>+47 488 90 949</strong>
					</p>
				</Card>
				<Card class="p-4">
					<p class="text-muted-foreground text-sm leading-relaxed">
						Samuel Grimstad<br />
						<strong>+47 930 91 002</strong>						
					</p>
				</Card>
			</div>
		</div>

		<p class="text-muted-foreground text-sm leading-relaxed">
			Vi ber om at taler ikke overstiger 4 minutter, andre typer innslag kan være lenger hvis toastmasterene godtar det.
			Gi de beskjed innen 20.juli 2027, spesielt for sangtekster og lignende som du vil ha med i programmet
		</p>
	</div>
</SectionShell>
