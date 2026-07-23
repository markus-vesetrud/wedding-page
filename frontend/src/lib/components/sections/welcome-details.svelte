<script lang="ts">
	import SurfaceCard from "../surface-card.svelte";
	import CalendarAdd from "../ui/icon/calendar-add.svelte";
	import Map from "../ui/icon/map.svelte";

	const events = [
		{
			kind: 'Vielse',
			time: '14:00',
			place: 'Nittedal kirke',
			address: 'Kirkeveien 121, 1480 Slattum'
		},
		{
			kind: 'Fest',
			time: '16:00',
			place: 'Nittedal kirkestue',
			address: 'Kirkeveien 123, 1480 Slattum'
		}
	];

	const mapHref =
		'https://www.google.com/maps/search/?api=1&query=Nittedal+kirke+Kirkeveien+121+1480+Slattum';
	const calendarHref =
		'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Malin+og+Markus+sitt+bryllup&dates=20270731T120000Z/20270731T210000Z&location=Nittedal+kirke,+Kirkeveien+121,+1480+Slattum';
</script>

<div>
	<p class="my-4 text-sm">Vi gleder oss enormt til å feire dagen sammen med dere! <br/>Her finner dere alt det praktiske, programmet for dagen, og oversikt over gaver og kaker. Ta gjerne en titt rundt :D	</p>

	<div class="my-4 grid gap-3 sm:grid-cols-2">
		{#each events as event (event.kind)}
			<SurfaceCard class="p-5">
				<p class="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
					{event.kind}
				</p>
				<p class="mt-2 text-2xl font-extrabold tracking-tight">{event.time}</p>
				<p class="mt-1 font-semibold">{event.place}</p>
				<p class="text-muted-foreground text-sm">{event.address}</p>
			</SurfaceCard>
		{/each}
	</div>

	<div class="mt-4 flex flex-wrap gap-3">
		<a
			href={mapHref}
			target="_blank"
			rel="noreferrer"
			class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:bg-muted-foreground"
		>
			<Map size={25} />
			<span>Åpne i kart</span>
		</a>
		<a
			href={calendarHref}
			target="_blank"
			rel="noreferrer"
			class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-card border px-5 py-3 text-sm font-semibold hover:bg-muted"
		>
			<CalendarAdd size={25} />
			<span>Legg dagen i kalender</span>
		</a>
	</div>
</div>
