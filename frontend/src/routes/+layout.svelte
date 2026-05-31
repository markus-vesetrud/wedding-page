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

<div
	class="min-h-screen text-foreground"
	style="background-color: hsla(130, 100%, 95%, 1); background-image: linear-gradient(120deg, hsla(130, 100%, 95%, 1) 0%, hsla(236, 100%, 97%, 1) 45%, hsla(351, 100%, 93%, 1) 100%);
"
>
	{@render children()}
</div>
