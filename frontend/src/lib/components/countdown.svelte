<script lang="ts">
    import { onMount } from 'svelte';
    const weddingDate = new Date('2027-07-31T14:00:00+02:00');

    let countdownText = $state('');

    function updateCountdown() {
        const diff = weddingDate.getTime() - Date.now();

        // Round up while counting down and down after, so zero is shown for one second rather than two
        const totalSeconds = diff >= 0 ? Math.ceil(diff / 1000) : Math.floor(-diff / 1000);
        const days = Math.floor(totalSeconds / 60 / 60 / 24);
        const hours = Math.floor((totalSeconds / 60 / 60) % 24);
        const minutes = Math.floor((totalSeconds / 60) % 60);
        const seconds = totalSeconds % 60;
        const secondsText = seconds < 10 ? `0${seconds}` : seconds.toString();
        countdownText = `${days} dager, ${hours} timer, ${minutes} minutter og ${secondsText} sekunder`;

        if (diff < 0) {
            countdownText = `for ${countdownText} siden`
        } else {
            countdownText = `om ${countdownText}`
        }
    }



    onMount(() => {
        updateCountdown();

        // Schedule each tick just after the next whole second. Recomputing the delay every time
        // keeps timer lateness from accumulating, and the margin keeps a slightly early timer
        // from firing before the displayed second has changed.
        const marginMs = 10;
        const delayToNextSecond = () => 1000 - (Date.now() % 1000) + marginMs;

        let timeout = setTimeout(updateTimeout, delayToNextSecond());

        function updateTimeout() {
            updateCountdown();
            timeout = setTimeout(updateTimeout, delayToNextSecond());
        }

        return () => {
            clearTimeout(timeout);
        };
    });
</script>

<p class="text-muted-foreground text-center text-md tracking-wide">{countdownText}</p>

