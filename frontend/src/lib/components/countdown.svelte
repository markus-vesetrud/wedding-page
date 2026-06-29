<script lang="ts">
    import { onMount } from 'svelte';
    const weddingDate = new Date('2027-07-31T14:00:00+02:00');

    let days = 0;
    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    function updateCountdown() {
        const diff = weddingDate.getTime() - Date.now();

        if (diff <= 0) return;

        days = Math.floor(diff / 1000 / 60 / 60 / 24);
        hours = Math.floor((diff / 1000 / 60 / 60) % 24);
        minutes = Math.floor((diff / 1000 / 60) % 60);
        seconds = Math.floor((diff / 1000) % 60);
    }

    onMount(() => {
        updateCountdown();

        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    });
</script>


<div class="flex justify-center gap-2">
    <div class="flex flex-col items-center justify-center rounded-md border-1 border-black w-24 h-22">
        <div class="text-3xl font-semibold leading-none px-">
            {days}
        </div>

        <div class="mt-2 text-sm text-center tracking-wide">
            Dager
        </div>
    </div>
    <div class="flex flex-col items-center justify-center rounded-md border-1 border-black w-24 h-22">
        <div class="text-3xl font-semibold leading-none px-">
            {hours}
        </div>

        <div class="mt-2 text-sm text-center tracking-wide">
            Timer
        </div>
    </div>
    <div class="flex flex-col items-center justify-center rounded-md border-1 border-black w-24 h-22">
        <div class="text-3xl font-semibold leading-none px-">
            {minutes}
        </div>

        <div class="mt-2 text-sm text-center tracking-wide">
            Minutter
        </div>
    </div>
    <div class="flex flex-col items-center justify-center rounded-md border-1 border-black w-24 h-22">
        <div class="text-3xl font-semibold leading-none px-">
            {seconds}
        </div>

        <div class="mt-2 text-sm text-center tracking-wide">
            Sekunder
        </div>
    </div>
</div>

