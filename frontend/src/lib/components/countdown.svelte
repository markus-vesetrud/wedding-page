<script lang="ts">
    import { onMount } from 'svelte';
    import SurfaceCard from './surface-card.svelte';
    const weddingDate = new Date('2027-07-31T14:00:00+02:00');

    let countDownSections: Array<{ value: number; label: string }>;

    function updateCountdown() {
        const diff = weddingDate.getTime() - Date.now();

        if (diff <= 0) return;

        countDownSections = [
            { value: Math.floor(diff / 1000 / 60 / 60 / 24), label: 'dager' },
            { value: Math.floor((diff / 1000 / 60 / 60) % 24), label: 'timer' },
            { value: Math.floor((diff / 1000 / 60) % 60), label: 'minutter' },
            // { value: Math.floor((diff / 1000) % 60), label: 'sekunder' },
        ]; 
    }

    onMount(() => {
        updateCountdown();

        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    });
</script>


<div class="flex justify-center gap-2">
    {#each countDownSections as count}
        <SurfaceCard class="flex w-24 flex-col items-center justify-center p-4">
            <div class="text-3xl font-extrabold leading-none tracking-tight">
                {count.value}
            </div>
            <div class="text-muted-foreground mt-2 text-xs font-semibold tracking-wide">
                {count.label}
            </div>
        </SurfaceCard>
    {/each}
</div>

