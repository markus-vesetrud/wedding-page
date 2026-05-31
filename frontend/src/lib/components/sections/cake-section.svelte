<script lang="ts">
	import type { Cake } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
    import SectionShell from '$lib/components/sections/section-shell.svelte';
	import ListItem from '$lib/components/sections/list-item.svelte';

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

<SectionShell
    id="kaker"
    title="Kakeoversikt"
    ingress="Se hvem som baker hva, hvilke kaker vi fortsatt ønsker oss, og legg gjerne til flere kakeforslag."
>
    <div class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
                <h3 class="text-sm font-semibold">Tatt av bakere</h3>
                <ul class="space-y-2">
                    {#if isLoading && cakes.length === 0}
                        {#each Array(2) as _, index (index)}
                            <ListItem isLoading />
                        {/each}
                    {:else if claimed.length === 0}
                        <li class="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">Ingen kaker er tatt ennå.</li>
                    {:else}
                        {#each claimed as cake (cake.id)}
                            <ListItem itemClass="flex items-center justify-between">
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
                            </ListItem>
                        {/each}
                    {/if}
                </ul>
            </div>
            <div class="space-y-2">
                <h3 class="text-sm font-semibold">Ønsket, ikke tatt ennå</h3>
                <ul class="space-y-2">
                    {#if isLoading && cakes.length === 0}
                        {#each Array(2) as _, index (index)}
                            <ListItem isLoading />
                        {/each}
                    {:else if wanted.length === 0}
                        <li class="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">Ingen åpne kakeønsker akkurat nå.</li>
                    {:else}
                        {#each wanted as cake (cake.id)}
                            <ListItem itemClass="flex items-center justify-between">
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
                            </ListItem>
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
</SectionShell>
