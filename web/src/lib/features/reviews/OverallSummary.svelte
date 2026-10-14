<script lang="ts">
	import { humanize } from '#lib/components/catalog/CatalogValue.svelte';
	import type { ReviewFacets } from '#lib/api/queries.js';
	import { count } from '#lib/format.js';

	let { summary }: { summary: ReviewFacets['overall_summary'] } = $props();

	const subRatings = $derived(
		Object.entries(summary.sub_category_averages ?? {}).filter((entry): entry is [string, number] => typeof entry[1] === 'number')
	);
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-col gap-1">
		<p class="text-heading-1 tabular-nums">
			{summary.overall_avg_rating?.toFixed(2) ?? '–'}<span class="text-heading-3 text-muted-foreground ms-1.5">/ 5</span>
		</p>
		<div class="text-body-sm text-ink-secondary flex flex-wrap items-center gap-x-3 gap-y-1">
			<span>{count(summary.total_reviews)} {summary.total_reviews === 1 ? 'review' : 'reviews'}</span>
			{#if summary.min_rating !== null && summary.max_rating !== null}
				<span class="text-muted-foreground">Range {summary.min_rating} to {summary.max_rating}</span>
			{/if}
		</div>
	</div>
	{#if subRatings.length > 0}
		<dl class="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2">
			{#each subRatings as [key, value] (key)}
				<dt class="text-caption text-muted-foreground">{humanize(key)}</dt>
				<dd class="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden="true">
					<span class="bg-chart-1 block h-full rounded-full" style:width="{(value / 5) * 100}%"></span>
				</dd>
				<dd class="text-body-sm text-right font-medium tabular-nums">{value.toFixed(2)}</dd>
			{/each}
		</dl>
	{/if}
</div>
