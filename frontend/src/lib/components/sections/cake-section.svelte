<script lang="ts">
    import type { Cake } from '$shared/types';
    import { sortByClaimedAndUpdatedAt } from '$lib/item-sorting';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
    import SectionShell from '$lib/components/sections/section-shell.svelte';
    import AnimatedList from '$lib/components/sections/animated-list.svelte';

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

    const sortedCakes = $derived(sortByClaimedAndUpdatedAt(cakes));
</script>

<SectionShell
    id="kaker"
    title="Kakeoversikt"
    ingress="Se hvem som baker hva, hvilke kaker vi fortsatt ønsker oss, og legg gjerne til flere kakeforslag."
>
    <div class="space-y-4">
        <AnimatedList items={sortedCakes} {isLoading} emptyText="Ingen kaker i listen ennå." loadingCount={4}>
            {#snippet children(cake)}
                <div class="flex items-center justify-between">
                    <label class="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={cake.claimed}
                            onchange={() => onToggleCake(cake.id)}
                            class="text-primary focus:ring-ring h-4 w-4 rounded border"
                        />
                        <span class={cake.claimed ? 'text-muted-foreground line-through' : ''}>{cake.name}</span>
                    </label>
                    <span class="text-muted-foreground text-xs">{cake.claimed ? (cake.bakerName ?? 'Baker') : 'Mangler baker'}</span>
                </div>
            {/snippet}
        </AnimatedList>
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
