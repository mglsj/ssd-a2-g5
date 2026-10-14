<script lang="ts">
	import { cn } from '#lib/utils.js';
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		eyebrow?: string;
		description?: string;
		class?: string;
		/** Buttons on the right, below the title on phones. */
		actions?: Snippet;
		/** Extra content under the description, such as badges. */
		children?: Snippet;
	};

	let { title, eyebrow, description, class: className, actions, children }: Props = $props();
</script>

<header class={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
	<div class="flex min-w-0 flex-col gap-2">
		{#if eyebrow}
			<p class="text-eyebrow text-muted-foreground uppercase">{eyebrow}</p>
		{/if}
		<h1 class="text-heading-2 sm:text-heading-1 text-balance break-words">{title}</h1>
		{#if description}
			<p class="text-body-md text-ink-secondary max-w-2xl">{description}</p>
		{/if}
		{@render children?.()}
	</div>
	{#if actions}
		<div class="flex shrink-0 flex-wrap gap-2">{@render actions()}</div>
	{/if}
</header>
