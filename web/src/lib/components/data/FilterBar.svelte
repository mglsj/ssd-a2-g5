<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import { cn } from '#lib/utils.js';
	import type { Snippet } from 'svelte';

	type Props = {
		/** Shows "Clear filters" when any filter is set. */
		active?: boolean;
		onclear?: () => void;
		label?: string;
		class?: string;
		children: Snippet;
	};

	let { active = false, onclear, label = 'Filters', class: className, children }: Props = $props();
</script>

<div role="search" aria-label={label} class={cn('flex flex-wrap items-end gap-3', className)}>
	{@render children()}
	{#if active && onclear}
		<Button variant="ghost" onclick={onclear}>
			<XIcon data-icon="inline-start" />
			Clear filters
		</Button>
	{/if}
</div>
