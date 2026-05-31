<script lang="ts">
	import type { Guest } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	let {
		guests,
		isLoading,
		newGuest,
		onNewGuestChange,
		onAddGuest,
		onToggleGuest,
		readOnly = false
	}: {
		guests: Guest[];
		isLoading: boolean;
		newGuest: string;
		onNewGuestChange: (value: string) => void;
		onAddGuest: () => void;
		onToggleGuest: (id: string) => void;
			readOnly?: boolean;
	} = $props();
</script>

<section id="gjester" class="pb-[50svh] pt-0">
	<div class="space-y-4">
		<h2 class="text-2xl font-semibold tracking-tight">Gjesteliste</h2>
		<p class="text-muted-foreground text-sm leading-relaxed">
			{#if readOnly}
				Oversikt over gjestene som er invitert.
			{:else}
				Finn navnet ditt og huk av for om du kommer. Allergier registreres kun når du markerer ditt eget navn, og vises ikke for andre.
			{/if}
		</p>
		<ul class="space-y-2">
			{#if isLoading && guests.length === 0}
				{#each Array(4) as _, index (index)}
					<li class="bg-muted/60 rounded-lg border p-3 animate-pulse">
						<div class="h-4 w-2/3 rounded bg-muted"></div>
					</li>
				{/each}
			{:else if guests.length === 0}
				<li class="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">Ingen gjester i listen ennå.</li>
			{:else}
				{#each guests as guest (guest.id)}
					<li class="bg-muted/60 flex items-center justify-between rounded-lg border p-3">
						<label class="flex items-center gap-3">
							{#if readOnly}
								<span class={`inline-flex h-4 min-w-4 items-center justify-center rounded border px-1 text-[10px] ${guest.checked ? 'border-primary text-primary' : 'text-muted-foreground border-muted-foreground/40'}`}>
									{guest.checked ? '✓' : '–'}
								</span>
							{:else}
								<input
									type="checkbox"
									checked={guest.checked}
									onchange={() => onToggleGuest(guest.id)}
									class="text-primary focus:ring-ring h-4 w-4 rounded border"
								/>
							{/if}
							<span class={guest.checked ? 'text-muted-foreground line-through' : ''}>{guest.name}</span>
						</label>
						<span class="text-muted-foreground text-xs">{guest.checked ? 'Kommer' : 'Ikke bekreftet'}</span>
					</li>
				{/each}
			{/if}
		</ul>
		{#if !readOnly}
			<form
				class="flex flex-col gap-3 sm:flex-row"
				onsubmit={(e) => {
					e.preventDefault();
					onAddGuest();
				}}
			>
				<Input
					type="text"
					value={newGuest}
					oninput={(e: Event) => onNewGuestChange((e.currentTarget as HTMLInputElement).value)}
					placeholder="Legg til gjest"
				/>
				<Button type="submit" class="min-w-28 whitespace-nowrap">Legg til</Button>
			</form>
		{/if}
	</div>
</section>
