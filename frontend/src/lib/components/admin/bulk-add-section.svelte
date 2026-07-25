<script lang="ts">
	import { onDestroy } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Button } from '$lib/components/ui/button';

	let {
		list,
		title,
		description,
		placeholder,
		adminHeaders,
		onUnauthorized,
		onAdded
	}: {
		list: 'gifts' | 'cakes';
		title: string;
		description: string;
		placeholder: string;
		adminHeaders: () => Record<string, string>;
		onUnauthorized: () => void;
		onAdded: () => void;
	} = $props();

	let text = $state('');
	let submitting = $state(false);
	let error = $state('');
	let addedCount = $state<number | null>(null);
	let addedCountTimer: ReturnType<typeof setTimeout> | null = null;

	async function submitBulkAdd() {
		error = '';
		const names = text
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);

		if (names.length === 0) {
			error = 'Skriv inn minst ett navn, ett per linje.';
			return;
		}

		submitting = true;
		try {
			const res = await fetch(`/api/admin/bulk-add/${list}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...adminHeaders() },
				body: JSON.stringify({ names })
			});

			if (res.status === 401) {
				onUnauthorized();
				return;
			}

			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(body.error ?? `Klarte ikke å legge til (${res.status})`);
			}

			const json = (await res.json()) as { items: unknown[] };
			addedCount = json.items.length;
			text = '';
			onAdded();

			if (addedCountTimer) clearTimeout(addedCountTimer);
			addedCountTimer = setTimeout(() => {
				addedCount = null;
				addedCountTimer = null;
			}, 4000);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Klarte ikke å legge til.';
		} finally {
			submitting = false;
		}
	}

	onDestroy(() => {
		if (addedCountTimer) clearTimeout(addedCountTimer);
	});
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{title}</Card.Title>
		<Card.Description>{description}</Card.Description>
	</Card.Header>
	<Card.Content>
		<form
			class="space-y-3"
			onsubmit={(e) => {
				e.preventDefault();
				submitBulkAdd();
			}}
		>
			<Textarea
				value={text}
				oninput={(e: Event) => (text = (e.currentTarget as HTMLTextAreaElement).value)}
				{placeholder}
				rows={5}
				required
			/>
			<Button type="submit" disabled={submitting} class="w-full">
				{submitting ? 'Legger til ...' : 'Legg til alle'}
			</Button>
		</form>

		{#if addedCount !== null}
			<p class="pt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
				✓ La til {addedCount} {addedCount === 1 ? 'element' : 'elementer'}.
			</p>
		{/if}

		{#if error}
			<p class="pt-3 text-sm text-red-600">{error}</p>
		{/if}
	</Card.Content>
</Card.Root>
