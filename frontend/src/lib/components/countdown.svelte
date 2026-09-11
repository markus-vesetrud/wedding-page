<script lang="ts">
    import { onMount } from 'svelte';
    const weddingDate = new Date('2027-07-31T14:00:00+02:00');

    let countdownText = $state('');

    function updateCountdown() {
        const diff = weddingDate.getTime() - Date.now();

        if (diff <= 0) {
            countdownText = 'i dag';
            return;
        }

        const days = Math.floor(diff / 1000 / 60 / 60 / 24);
        const hours = Math.floor((diff / 1000 / 60 / 60) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        countdownText = `${days} dager, ${hours} timer og ${minutes} minutter`;
    }

    onMount(() => {
        updateCountdown();

        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    });
</script>

<p class="text-muted-foreground text-center text-sm tracking-wide">om {countdownText}</p>

