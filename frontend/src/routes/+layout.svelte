<script>
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Bryllupsside</title>
	<meta
		name="description"
		content="Praktisk informasjon, gjesteliste, gaveliste og kakeoversikt for bryllupet"
	/>
</svelte:head>

<div class="min-h-screen bg-background text-foreground">
	<header class="border-b bg-card/70">
		<div class="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-8 md:px-6">
			<p class="text-muted-foreground text-sm">31. juli 2027 • Nittedal kirke</p>
			<h1 class="text-3xl font-semibold tracking-tight md:text-4xl">Malin &amp; Markus sitt bryllup</h1>
		</div>
	</header>
	{@render children()}
</div>
