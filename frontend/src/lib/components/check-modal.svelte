<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import { Button } from '$lib/components/ui/button';
	import type { Snippet } from 'svelte';

    let {
        open,
        title,
        saveText,
        description = '',
        modalIsAbortNotConfirm,
        onConfirm,
        onClose,
        children
    }: {
        open: boolean;
        title: string;
        saveText: string;
        description?: string;
        modalIsAbortNotConfirm?: boolean;
        onConfirm: () => void;
        onClose: () => void;
        children?: Snippet;

    } = $props();


</script>

{#if open}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
        <Card.Root class="w-full max-w-md">
            <Card.Header>
                <Card.Title>{title}</Card.Title>
                {#if description}
                    <Card.Description>{description}</Card.Description>
                {/if}
            </Card.Header>

            <Card.Content>
                <form onsubmit={(e) => {
                    e.preventDefault();
                    onConfirm();
                }}>

                    {@render children?.()}
                    
                    <div class="flex justify-end gap-2 mt-2">
                        <Button variant={modalIsAbortNotConfirm ? "default" : "outline"} onclick={onClose}>Avbryt</Button>
                        
                        <Button class={modalIsAbortNotConfirm ? "" : "bg-emerald-600 hover:bg-emerald-700" } variant={modalIsAbortNotConfirm ? "outline" : "default"} type='submit'>{saveText}</Button>
                    </div>
                </form>
            </Card.Content>
        </Card.Root>
    </div>
{/if}