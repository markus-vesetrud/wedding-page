<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import { Button } from '$lib/components/ui/button';
	import type { Snippet } from 'svelte';

    let {
        open,
        title,
        description = '',
        saveText,
        onConfirm,
        onClose,
        children
    }: {
        open: boolean;
        title: string;
        description?: string;
        saveText: string;
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
                        <Button variant="outline" onclick={onClose}>Avbryt</Button>
                        
                        <Button type='submit'>{saveText}</Button>
                    </div>
                </form>
            </Card.Content>
        </Card.Root>
    </div>
{/if}