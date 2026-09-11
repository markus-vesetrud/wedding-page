<script lang="ts">
	import SectionShell from '$lib/components/sections/section-shell.svelte';
	import SurfaceCard from '$lib/components/surface-card.svelte';
	import Card from '../ui/card/card.svelte';
</script>

<SectionShell
	id="taler"
	title="Taler og underholdning"
	ingress="Vil du holde en tale, lage et innslag eller bidra under middagen? Vi setter stor pris på det! Ta kontakt med toastmasterene våre her"
>
	<div class="space-y-4">
		<div>
			<h3 class="text-accent mb-3 text-xs font-semibold tracking-widest uppercase">Kontakt toastmasterne</h3>
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
			Hvert innslag bør vare maks <strong>4 minutter</strong>. Gi gjerne beskjed til toastmasterne innen
			[Fyll inn frist], slik at innslaget kan settes inn i programmet.
		</p>
	</div>
</SectionShell>
