<script lang="ts">
    import SectionShell from '$lib/components/sections/section-shell.svelte';
    import { onMount } from 'svelte';
	import Countdown from '../countdown.svelte';
</script>

<SectionShell
    id="praktisk"
    title="Praktisk"
>
	<span class="text leading-relaxed">
		Bryllupet skjer den <strong>31. Juli 2027</strong>
	</span>

    <div class="mx-auto mt-6 max-w-2xl space-y-6">
        <div>
            <p class="text-muted-foreground text-xs uppercase tracking-wide">
                Vielse
            </p>

            <p class="mt-1 font-medium">
                Kl. 14:00 · Nittedal kirke
            </p>

            <p class="text-muted-foreground text-sm">
                Kirkeveien 121, 1480 Slattum
            </p>
        </div>

        <div class="border-border border-t pt-6">
            <p class="text-muted-foreground text-xs uppercase tracking-wide">
                Fest
            </p>

            <p class="mt-1 font-medium">
                Fra kl. 16:00 · Nittedal kirkestue
            </p>

            <p class="text-muted-foreground text-sm">
                Kirkeveien 123, 1480 Slattum
            </p>
        </div>

        <div class="border-border border-t pt-6 text-sm font-medium">
            <a
                href="https://www.google.com/maps/search/?api=1&query=Nittedal+kirke+Kirkeveien+121+1480+Slattum"
                target="_blank"
                rel="noreferrer"
                class="text-primary underline underline-offset-2"
            >
                Åpne kart
            </a>

            <span class="text-muted-foreground mx-3">•</span>

            <a
                href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=Malin+og+Markus+sitt+bryllup&dates=20270731T120000Z/20270731T210000Z&location=Nittedal+kirke,+Kirkeveien+121,+1480+Slattum"
                target="_blank"
                rel="noreferrer"
                class="text-primary underline underline-offset-2"
            >
                Legg dagen i kalender
            </a>
        </div>
    </div>
</SectionShell>