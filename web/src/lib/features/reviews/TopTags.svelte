<script lang="ts">
	import { humanize } from '#lib/components/catalog/CatalogValue.svelte';
	import type { ReviewFacets } from '#lib/api/queries.js';
	import { count } from '#lib/format.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		tags: ReviewFacets['most_frequent_tags'];
		/** The tag the review list is filtered by. */
		active: string | null;
		/** Called with the clicked tag, or null when the active tag is clicked again. */
		onselect: (tag: string | null) => void;
		class?: string;
	};

	let { tags, active, onselect, class: className }: Props = $props();

	// Bars start at zero, so similar frequencies look similar.
	const max = $derived(Math.max(1, ...tags.map((t) => t.frequency)));
	// A tag from a review can be outside the top ten. Then nothing here is dimmed.
	const dimOthers = $derived(tags.some((t) => t.tag === active));
</script>

<ul class={cn('flex flex-col gap-1', className)} aria-label="Top location tags">
	{#each tags as tag (tag.tag)}
		{@const pressed = active === tag.tag}
		<li>
			<button
				type="button"
				aria-pressed={pressed}
				aria-label="{humanize(tag.tag)}: {count(tag.frequency)} reviews, average {tag.avg_rating.toFixed(2)}. {pressed
					? 'Remove filter'
					: 'Filter reviews'}"
				onclick={() => onselect(pressed ? null : tag.tag)}
				class={cn(
					'text-caption hover:bg-accent focus-visible:ring-ring/50 -mx-1 grid w-[calc(100%+0.5rem)] grid-cols-[7.5rem_1fr_auto] items-center gap-2 rounded-xs px-1 py-1 text-left outline-none focus-visible:ring-[3px]',
					pressed && 'bg-accent font-medium',
					dimOthers && !pressed && 'opacity-50'
				)}
			>
				<span class="truncate" title={humanize(tag.tag)}>{humanize(tag.tag)}</span>
				<span class="bg-muted h-2 overflow-hidden rounded-full">
					<span class="bg-chart-1 block h-full rounded-full" style:width="{(tag.frequency / max) * 100}%"></span>
				</span>
				<span class="text-ink-secondary text-right tabular-nums">
					{count(tag.frequency)} · {tag.avg_rating.toFixed(1)}★
				</span>
			</button>
		</li>
	{/each}
</ul>
