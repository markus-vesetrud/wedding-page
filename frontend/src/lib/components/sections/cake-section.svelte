<script lang="ts">
	import type { Cake } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	let {
		cakes,
		newCake,
		onNewCakeChange,
		onAddCake,
		onToggleCake
	}: {
		cakes: Cake[];
		newCake: string;
		onNewCakeChange: (value: string) => void;
		onAddCake: () => void;
		onToggleCake: (id: string) => void;
	} = $props();

	const claimed = $derived(cakes.filter((cake) => cake.checked));
	const wanted = $derived(cakes.filter((cake) => !cake.checked));
</script>

<section id="kaker" class="scroll-mt-28 snap-start snap-always min-h-[100svh] pb-[90svh] pt-20 md:pt-24">
	<div class="space-y-4">
		<h2 class="text-2xl font-semibold tracking-tight">Kakeoversikt</h2>
		<p class="text-muted-foreground text-sm leading-relaxed">
			Se hvem som baker hva, hvilke kaker vi fortsatt ønsker oss, og legg gjerne til flere kakeforslag.
		</p>
			<form
				class="flex flex-col gap-3 sm:flex-row"
				onsubmit={(e) => {
					e.preventDefault();
					onAddCake();
				}}
			>
				<Input
					type="text"
					value={newCake}
					oninput={(e: Event) => onNewCakeChange((e.currentTarget as HTMLInputElement).value)}
					placeholder="Legg til kakeønske"
				/>
				<Button type="submit">Legg til</Button>
			</form>

			<div class="grid gap-4 md:grid-cols-2">
				<div class="space-y-2">
					<h3 class="text-sm font-semibold">Tatt av bakere</h3>
					<ul class="space-y-2">
						{#each claimed as cake (cake.id)}
							<li class="bg-muted/60 flex items-center justify-between rounded-lg border p-3">
								<label class="flex items-center gap-3">
									<input
										type="checkbox"
										checked={cake.checked}
										onchange={() => onToggleCake(cake.id)}
										class="text-primary focus:ring-ring h-4 w-4 rounded border"
									/>
									<span class="text-muted-foreground line-through">{cake.name}</span>
								</label>
								<span class="text-muted-foreground text-xs">{cake.bakerName ?? 'Baker'}</span>
							</li>
						{/each}
					</ul>
				</div>
				<div class="space-y-2">
					<h3 class="text-sm font-semibold">Ønsket, ikke tatt ennå</h3>
					<ul class="space-y-2">
						{#each wanted as cake (cake.id)}
							<li class="bg-muted/60 flex items-center justify-between rounded-lg border p-3">
								<label class="flex items-center gap-3">
									<input
										type="checkbox"
										checked={cake.checked}
										onchange={() => onToggleCake(cake.id)}
										class="text-primary focus:ring-ring h-4 w-4 rounded border"
									/>
									<span>{cake.name}</span>
								</label>
								<span class="text-muted-foreground text-xs">Mangler baker</span>
							</li>
						{/each}
					</ul>
				</div>
			</div>
	</div>
</section>
