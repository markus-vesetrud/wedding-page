<script lang="ts">
	import SectionShell from '$lib/components/sections/section-shell.svelte';
</script>

<SectionShell
	id="praktisk"
	title="Praktisk"
	ingress="Her er tidspunkt og sted for vielse og fest."
>
	<div class="grid gap-4 md:grid-cols-2">
		<div class="bg-muted rounded-xl p-4">
			<p class="text-muted-foreground text-xs uppercase tracking-wide">Vielsen</p>
			<p class="mt-1 text-sm font-medium">Lørdag 31. juli 2027 kl. 14:00</p>
			<p class="text-muted-foreground mt-1 text-sm">Nittedal kirke, Kirkeveien 121, 1480 Slattum</p>
			<div class="mt-3 space-y-1 text-sm font-medium">
				<p>
					<a
						href="https://www.google.com/maps/search/?api=1&query=Nittedal+kirke+Kirkeveien+121+1480+Slattum"
						target="_blank"
						rel="noreferrer"
						class="text-primary underline underline-offset-2"
					>
						Se vielsen i Google Maps
					</a>
				</p>
				<p>
					<a
						href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=Vielse+-+Malin+og+Markus+sitt+bryllup&dates=20270731T120000Z/20270731T133000Z&location=Nittedal+kirke,+Kirkeveien+121,+1480+Slattum&details=Vielsen+starter+kl+14:00+i+Nittedal+kirke."
						target="_blank"
						rel="noreferrer"
						class="text-primary underline underline-offset-2"
					>
						Legg vielsen i kalender
					</a>
				</p>
			</div>
		</div>

		<div class="bg-muted rounded-xl p-4">
			<p class="text-muted-foreground text-xs uppercase tracking-wide">Festen</p>
			<p class="mt-1 text-sm font-medium">Fra kl. 16:00</p>
			<p class="text-muted-foreground mt-1 text-sm">Nittedal kirkestue, Kirkeveien 123, 1480 Slattum</p>
			<div class="mt-3 space-y-1 text-sm font-medium">
				<p>
					<a
						href="https://www.google.com/maps/search/?api=1&query=Nittedal+kirkestue+Kirkeveien+123+1480+Slattum"
						target="_blank"
						rel="noreferrer"
						class="text-primary underline underline-offset-2"
					>
						Se festen i Google Maps
					</a>
				</p>
				<p>
					<a
						href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=Bryllupsfest+-+Malin+og+Markus&dates=20270731T140000Z/20270731T210000Z&location=Nittedal+kirkestue,+Kirkeveien+123,+1480+Slattum&details=Bryllupsfest+fra+kl+16:00+i+Nittedal+kirkestue."
						target="_blank"
						rel="noreferrer"
						class="text-primary underline underline-offset-2"
					>
						Legg festen i kalender
					</a>
				</p>
			</div>
		</div>
	</div>
</SectionShell>
