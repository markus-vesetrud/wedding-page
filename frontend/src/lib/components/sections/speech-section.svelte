<script lang="ts">
	import SectionShell from '$lib/components/sections/section-shell.svelte';
	import SurfaceCard from '$lib/components/surface-card.svelte';
	import Card from '../ui/card/card.svelte';
</script>

<SectionShell
	id="taler"
	title="Taler og underholdning"
	ingress="Vil du holde en tale, lage et innslag eller bidra under middagen? Vi setter stor pris på det! Ta kontakt med toastmasterene våre!"
>
	<div class="space-y-4">
		<div>
			<h3 class="mb-2 font-semibold">Kontakt toastmasterne</h3>
			<div class="grid gap-4 sm:grid-cols-2">
				<Card class="p-4">
					<p class="text-muted-foreground text-sm leading-relaxed">
						Navn: [Fyll inn navn]<br />
						Telefon: [Fyll inn telefonnummer]<br />
						E-post: [Fyll inn e-post]
					</p>
				</Card>
				<Card class="p-4">
					<p class="text-muted-foreground text-sm leading-relaxed">
						Navn: [Fyll inn navn]<br />
						Telefon: [Fyll inn telefonnummer]<br />
						E-post: [Fyll inn e-post]
					</p>
				</Card>
			</div>
		</div>

		<SurfaceCard class="p-5">
			<h3 class="font-semibold">Tidsramme</h3>
			<p class="text-muted-foreground text-sm leading-relaxed">
				Hvert innslag bør vare maks [Fyll inn antall] minutter. Gi gjerne beskjed til toastmasterne innen
				[Fyll inn frist], slik at innslaget kan settes inn i programmet.
			</p>
		</SurfaceCard>
	</div>
</SectionShell>
