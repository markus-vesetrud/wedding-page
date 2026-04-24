<script lang="ts">
	import type { Guest } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	let {
		guests,
		newGuest,
		onNewGuestChange,
		onAddGuest,
		onToggleGuest
	}: {
		guests: Guest[];
		newGuest: string;
		onNewGuestChange: (value: string) => void;
		onAddGuest: () => void;
		onToggleGuest: (id: string) => void;
	} = $props();
</script>

<section id="gjester" class="scroll-mt-20 py-8 md:py-10">
	<div class="space-y-4">
		<h2 class="text-2xl font-semibold tracking-tight">Gjesteliste</h2>
		<p class="text-muted-foreground text-sm leading-relaxed">
			Finn navnet ditt og huk av for om du kommer. Allergier registreres kun når du markerer ditt eget navn, og vises ikke for andre.
		</p>
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
				<Button type="submit">Legg til</Button>
			</form>

			<ul class="space-y-2">
				{#each guests as guest (guest.id)}
					<li class="bg-muted/60 flex items-center justify-between rounded-lg border p-3">
						<label class="flex items-center gap-3">
							<input
								type="checkbox"
								checked={guest.checked}
								onchange={() => onToggleGuest(guest.id)}
								class="text-primary focus:ring-ring h-4 w-4 rounded border"
							/>
							<span class={guest.checked ? 'text-muted-foreground line-through' : ''}>{guest.name}</span>
						</label>
						<span class="text-muted-foreground text-xs">{guest.checked ? 'Kommer' : 'Ikke bekreftet'}</span>
					</li>
				{/each}
			</ul>
	</div>
</section>
