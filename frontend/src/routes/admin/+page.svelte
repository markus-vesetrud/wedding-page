<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { Cake, CakeSuggestion, Gift, Invitation } from '$shared/types';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';

	const passwordStorageKey = 'wedding-admin-password';

	let password = $state('');
	let authenticated = $state(false);
	let checkingStoredPassword = $state(true);
	let loginError = $state('');
	let loadingSuggestions = $state(false);
	let suggestions = $state<CakeSuggestion[]>([]);
	let listError = $state('');
	let promotingId = $state<string | null>(null);
	let loadingLists = $state(false);
	let gifts = $state<Gift[]>([]);
	let cakes = $state<Cake[]>([]);
	let listsError = $state('');

	let invitationName = $state('');
	let guestNameInputs = $state<string[]>(['']);
	let creatingInvitation = $state(false);
	let invitationFormError = $state('');
	let createdInvitations = $state<{ id: string; name: string; guestCount: number; link: string }[]>([]);
	let copiedLink = $state<string | null>(null);
	let copiedLinkTimer: ReturnType<typeof setTimeout> | null = null;

	function adminHeaders(): Record<string, string> {
		return { 'x-admin-password': password };
	}

	async function loadSuggestions(): Promise<boolean> {
		loadingSuggestions = true;
		listError = '';

		try {
			const res = await fetch('/api/admin/cake-suggestions', { headers: adminHeaders() });

			if (res.status === 401) {
				return false;
			}

			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(body.error ?? `Klarte ikke å hente forslag (${res.status})`);
			}

			const json = (await res.json()) as { suggestions: CakeSuggestion[] };
			suggestions = json.suggestions;
			return true;
		} catch (e) {
			listError = e instanceof Error ? e.message : 'Klarte ikke å hente forslag.';
			return true;
		} finally {
			loadingSuggestions = false;
		}
	}

	async function loadLists(): Promise<boolean> {
		loadingLists = true;
		listsError = '';

		try {
			const res = await fetch('/api/admin/lists', { headers: adminHeaders() });

			if (res.status === 401) {
				return false;
			}

			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(body.error ?? `Klarte ikke å hente listene (${res.status})`);
			}

			const json = (await res.json()) as { gifts: Gift[]; cakes: Cake[] };
			gifts = json.gifts;
			cakes = json.cakes;
			return true;
		} catch (e) {
			listsError = e instanceof Error ? e.message : 'Klarte ikke å hente listene.';
			return true;
		} finally {
			loadingLists = false;
		}
	}

	async function login() {
		loginError = '';
		const ok = await loadSuggestions();
		if (!ok) {
			loginError = 'Feil passord.';
			return;
		}

		authenticated = true;
		localStorage.setItem(passwordStorageKey, password);
		loadLists();
	}

	function logout() {
		authenticated = false;
		password = '';
		suggestions = [];
		gifts = [];
		cakes = [];
		localStorage.removeItem(passwordStorageKey);
	}

	function addGuestInputRow() {
		guestNameInputs = [...guestNameInputs, ''];
	}

	function removeGuestInputRow(index: number) {
		if (guestNameInputs.length <= 1) return;
		guestNameInputs = guestNameInputs.filter((_, i) => i !== index);
	}

	async function createInvitation() {
		invitationFormError = '';
		const name = invitationName.trim();
		const guestNames = guestNameInputs.map((guestName) => guestName.trim()).filter(Boolean);

		if (!name || guestNames.length === 0) {
			invitationFormError = 'Fyll inn navn og minst én gjest.';
			return;
		}

		creatingInvitation = true;
		try {
			const res = await fetch('/api/admin/invitations', {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...adminHeaders() },
				body: JSON.stringify({ name, guestNames })
			});

			if (res.status === 401) {
				logout();
				return;
			}

			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(body.error ?? `Klarte ikke å opprette invitasjonen (${res.status})`);
			}

			const json = (await res.json()) as { invitation: Invitation };
			const link = `${location.origin}/invitasjon/${encodeURIComponent(json.invitation.id)}`;
			createdInvitations = [
				{
					id: json.invitation.id,
					name: json.invitation.name,
					guestCount: json.invitation.guestIds.length,
					link
				},
				...createdInvitations
			];
			invitationName = '';
			guestNameInputs = [''];
		} catch (e) {
			invitationFormError = e instanceof Error ? e.message : 'Klarte ikke å opprette invitasjonen.';
		} finally {
			creatingInvitation = false;
		}
	}

	async function copyLink(link: string) {
		try {
			await navigator.clipboard.writeText(link);
			copiedLink = link;
			if (copiedLinkTimer) clearTimeout(copiedLinkTimer);
			copiedLinkTimer = setTimeout(() => {
				copiedLink = null;
				copiedLinkTimer = null;
			}, 2000);
		} catch {
			invitationFormError = 'Klarte ikke å kopiere lenken. Kopier den manuelt i stedet.';
		}
	}

	async function promote(suggestion: CakeSuggestion) {
		promotingId = suggestion.id;
		listError = '';

		try {
			const res = await fetch(`/api/admin/cake-suggestions/${encodeURIComponent(suggestion.id)}/promote`, {
				method: 'POST',
				headers: adminHeaders()
			});

			if (res.status === 401) {
				logout();
				return;
			}

			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(body.error ?? `Klarte ikke å flytte forslaget (${res.status})`);
			}

			suggestions = suggestions.filter((entry) => entry.id !== suggestion.id);
			loadLists();
		} catch (e) {
			listError = e instanceof Error ? e.message : 'Klarte ikke å flytte forslaget.';
		} finally {
			promotingId = null;
		}
	}

	onMount(async () => {
		const stored = localStorage.getItem(passwordStorageKey);
		if (stored) {
			password = stored;
			const ok = await loadSuggestions();
			authenticated = ok;
			if (!ok) localStorage.removeItem(passwordStorageKey);
			else loadLists();
		}
		checkingStoredPassword = false;
	});

	onDestroy(() => {
		if (copiedLinkTimer) clearTimeout(copiedLinkTimer);
	});
</script>

<div class="mx-auto w-full max-w-2xl space-y-6 px-4 py-10 md:px-6">
	{#if checkingStoredPassword}
		<Card.Root>
			<Card.Content class="py-8 text-center text-sm text-muted-foreground">Laster ...</Card.Content>
		</Card.Root>
	{:else if !authenticated}
		<Card.Root>
			<Card.Header>
				<Card.Title>Admin</Card.Title>
				<Card.Description>Skriv inn admin-passordet for å se innsendte kakeforslag.</Card.Description>
			</Card.Header>
			<Card.Content>
				<form
					class="flex flex-col gap-3 sm:flex-row"
					onsubmit={(e) => {
						e.preventDefault();
						login();
					}}
				>
					<Input
						type="password"
						value={password}
						oninput={(e: Event) => (password = (e.currentTarget as HTMLInputElement).value)}
						placeholder="Passord"
						required
					/>
					<Button type="submit" class="min-w-28 whitespace-nowrap">Logg inn</Button>
				</form>
				{#if loginError}
					<p class="pt-3 text-sm text-red-600">{loginError}</p>
				{/if}
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>Kakeforslag</Card.Title>
				<Card.Description>
					Forslag sendt inn av gjester. Flytt de dere er enige om over til kakelisten, så blir de synlige og
					reserverbare for alle.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if loadingSuggestions}
					<p class="text-sm text-muted-foreground">Laster forslag ...</p>
				{:else if suggestions.length === 0}
					<p class="text-sm text-muted-foreground">Ingen nye kakeforslag akkurat nå.</p>
				{:else}
					<ul class="divide-y">
						{#each suggestions as suggestion (suggestion.id)}
							<li class="flex items-center justify-between gap-3 py-3">
								<span>
									<span class="font-medium">{suggestion.name}</span>
									{#if suggestion.bakerName}
										<span class="block text-sm text-muted-foreground">Foreslått av {suggestion.bakerName}</span>
									{/if}
								</span>
								<Button
									onclick={() => promote(suggestion)}
									disabled={promotingId === suggestion.id}
									class="whitespace-nowrap"
								>
									{promotingId === suggestion.id ? 'Flytter ...' : 'Flytt til kakelisten'}
								</Button>
							</li>
						{/each}
					</ul>
				{/if}

				{#if listError}
					<p class="pt-3 text-sm text-red-600">{listError}</p>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Gaveliste</Card.Title>
				<Card.Description>
					Hvem som har reservert hva er anonymisert - samme gjest får alltid samme navn her, slik at dere kan se
					mønstre uten å vite hvem det faktisk er.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if loadingLists}
					<p class="text-sm text-muted-foreground">Laster gaveliste ...</p>
				{:else if gifts.length === 0}
					<p class="text-sm text-muted-foreground">Ingen gaveønsker i listen ennå.</p>
				{:else}
					<ul class="divide-y">
						{#each gifts as gift (gift.id)}
							<li class="flex items-center justify-between gap-3 py-2">
								<span>{gift.name}</span>
								<span class="text-sm text-muted-foreground">
									{gift.claimed ? `Reservert av ${gift.gifterName ?? 'Ukjent'}` : 'Ledig'}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Kakeliste</Card.Title>
				<Card.Description>Hvem som baker hva, med fullt navn.</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if loadingLists}
					<p class="text-sm text-muted-foreground">Laster kakeliste ...</p>
				{:else if cakes.length === 0}
					<p class="text-sm text-muted-foreground">Ingen kaker i listen ennå.</p>
				{:else}
					<ul class="divide-y">
						{#each cakes as cake (cake.id)}
							<li class="flex items-center justify-between gap-3 py-2">
								<span>{cake.name}</span>
								<span class="text-sm text-muted-foreground">
									{cake.claimed ? `${cake.bakerName ?? 'Ukjent'}` : 'Ledig'}
								</span>
							</li>
						{/each}
					</ul>
				{/if}

				{#if listsError}
					<p class="pt-3 text-sm text-red-600">{listsError}</p>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Ny invitasjon</Card.Title>
				<Card.Description>Oppretter invitasjonen og gjestene i den samme operasjonen.</Card.Description>
			</Card.Header>
			<Card.Content>
				<form
					class="space-y-4"
					onsubmit={(e) => {
						e.preventDefault();
						createInvitation();
					}}
				>
					<div class="space-y-1">
						<label class="text-sm font-medium" for="invitationName">Navn på invitasjonen</label>
						<Input
							id="invitationName"
							type="text"
							value={invitationName}
							oninput={(e: Event) => (invitationName = (e.currentTarget as HTMLInputElement).value)}
							placeholder="F. eks. Familien Hansen"
							required
						/>
					</div>

					<div class="space-y-2">
						<span class="text-sm font-medium">Gjester</span>
						{#each guestNameInputs as guestName, index (index)}
							<div class="flex gap-2">
								<Input
									type="text"
									value={guestName}
									oninput={(e: Event) => (guestNameInputs[index] = (e.currentTarget as HTMLInputElement).value)}
									placeholder="Gjestens navn"
									required
								/>
								{#if guestNameInputs.length > 1}
									<Button type="button" variant="outline" onclick={() => removeGuestInputRow(index)}>
										Fjern
									</Button>
								{/if}
							</div>
						{/each}
						<Button type="button" variant="outline" onclick={addGuestInputRow}>+ Legg til gjest</Button>
					</div>

					<Button type="submit" disabled={creatingInvitation} class="w-full">
						{creatingInvitation ? 'Oppretter ...' : 'Opprett invitasjon'}
					</Button>
				</form>

				{#if invitationFormError}
					<p class="pt-3 text-sm text-red-600">{invitationFormError}</p>
				{/if}

				{#if createdInvitations.length > 0}
					<div class="mt-6 space-y-3 border-t pt-4">
						<p class="text-sm font-medium">Nylig opprettet</p>
						{#each createdInvitations as created (created.id)}
							<div class="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
								<span>
									<span class="font-medium">{created.name}</span>
									<span class="block text-muted-foreground">
										{created.guestCount} gjest{created.guestCount === 1 ? '' : 'er'}
									</span>
								</span>
								<Button type="button" variant="outline" onclick={() => copyLink(created.link)}>
									{copiedLink === created.link ? 'Kopiert!' : 'Kopier lenke'}
								</Button>
							</div>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<button type="button" onclick={logout} class="text-sm text-muted-foreground underline">
			Logg ut
		</button>
	{/if}
</div>
