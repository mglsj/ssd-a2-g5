<script lang="ts">
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		/** Placeholder rows, for list-shaped content. Screens pass their own shape through QueryBoundary. */
		rows?: number;
		label?: string;
		class?: string;
	};

	let { rows = 3, label = 'Loading…', class: className }: Props = $props();
</script>

<div class={cn('flex flex-col gap-3', className)} role="status" aria-live="polite">
	<span class="sr-only">{label}</span>
	{#each { length: rows }, i (i)}
		<Skeleton class={cn('h-10 w-full', i === rows - 1 && rows > 1 && 'w-2/3')} />
	{/each}
</div>
