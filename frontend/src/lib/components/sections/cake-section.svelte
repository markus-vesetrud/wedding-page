<script lang="ts">
	import type { Cake } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	let {
		cakes,
        isLoading,
		newCake,
		onNewCakeChange,
		onAddCake,
		onToggleCake
	}: {
		cakes: Cake[];
        isLoading: boolean;
		newCake: string;
		onNewCakeChange: (value: string) => void;
		onAddCake: () => void;
		onToggleCake: (id: string) => void;
	} = $props();

	const claimed = $derived(cakes.filter((cake) => cake.checked));
	const wanted = $derived(cakes.filter((cake) => !cake.checked));
</script>

<section id="kaker" class="pb-[50svh] pt-0">
	<div class="space-y-4">
		<h2 class="text-2xl font-semibold tracking-tight">Kakeoversikt</h2>
		<p class="text-muted-foreground text-sm leading-relaxed">
			Se hvem som baker hva, hvilke kaker vi fortsatt ønsker oss, og legg gjerne til flere kakeforslag.
		</p>
        <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
                <h3 class="text-sm font-semibold">Tatt av bakere</h3>
                <ul class="space-y-2">
                    {#if isLoading && cakes.length === 0}
                        {#each Array(2) as _, index (index)}
                            <li class="bg-muted/60 rounded-lg border p-3 animate-pulse">
                                <div class="h-4 w-2/3 rounded bg-muted"></div>
                            </li>
                        {/each}
                    {:else if claimed.length === 0}
                        <li class="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">Ingen kaker er tatt ennå.</li>
                    {:else}
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
                    {/if}
                </ul>
            </div>
            <div class="space-y-2">
                <h3 class="text-sm font-semibold">Ønsket, ikke tatt ennå</h3>
                <ul class="space-y-2">
                    {#if isLoading && cakes.length === 0}
                        {#each Array(2) as _, index (index)}
                            <li class="bg-muted/60 rounded-lg border p-3 animate-pulse">
                                <div class="h-4 w-2/3 rounded bg-muted"></div>
                            </li>
                        {/each}
                    {:else if wanted.length === 0}
                        <li class="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">Ingen åpne kakeønsker akkurat nå.</li>
                    {:else}
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
                    {/if}
                </ul>
            </div>
        </div>
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
            <Button type="submit" class="min-w-28 whitespace-nowrap">Legg til</Button>
        </form>
	</div>
</section>
