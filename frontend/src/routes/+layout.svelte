<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<title>Our Wedding</title>
	<meta name="description" content="Wedding gift registry & guest list" />
</svelte:head>

<div class="app">
	<header>
		<h1>💍 Our Wedding</h1>
	</header>
	<main>
		{@render children()}
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
		background: #faf8f5;
		color: #333;
	}

	.app {
		max-width: 800px;
		margin: 0 auto;
		padding: 1rem;
	}

	header {
		text-align: center;
		padding: 2rem 0 1rem;
	}

	header h1 {
		font-size: 2rem;
		font-weight: 300;
		color: #6b5b4f;
	}

	main {
		padding: 1rem 0;
	}
</style>
