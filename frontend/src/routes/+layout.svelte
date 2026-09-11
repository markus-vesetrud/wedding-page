<script>
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Bryllup</title>
	<meta
		name="description"
		content="Praktisk informasjon, gjesteliste, gaveliste og kakeoversikt for bryllupet"
	/>
</svelte:head>

<div class="min-h-screen bg-background text-foreground">
	{@render children()}
</div>
