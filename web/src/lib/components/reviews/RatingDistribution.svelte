<script lang="ts">
	import { count } from '#lib/format.js';
	import { cn } from '#lib/utils.js';

	type Bucket = { rating: number; count: number; percentage: number };

	type Props = {
		buckets: Bucket[];
		/** Makes each row a link, for example to filter the review list by that rating. */
		href?: (rating: number) => string;
		active?: number | null;
		class?: string;
	};

	let { buckets, href, active = null, class: className }: Props = $props();

	// All five stars always show, highest first, even when the API leaves a bucket out.
	const rows = $derived(
		[5, 4, 3, 2, 1].map((rating) => buckets.find((b) => b.rating === rating) ?? { rating, count: 0, percentage: 0 })
	);
</script>

<ul class={cn('flex flex-col gap-1.5', className)} aria-label="Rating distribution">
	{#each rows as row (row.rating)}
		{@const label = `${row.rating} star: ${count(row.count)} reviews, ${row.percentage}%`}
		<li>
			<svelte:element
				this={href ? 'a' : 'div'}
				href={href?.(row.rating)}
				data-slot={href ? 'rating-row' : undefined}
				aria-label={label}
				aria-current={active === row.rating ? 'true' : undefined}
				title={label}
				class={cn(
					'text-caption grid grid-cols-[1.25rem_1fr_6.5rem] items-center gap-2 rounded-xs',
					href && 'hover:bg-accent focus-visible:ring-ring/50 -mx-1 px-1 py-0.5 outline-none focus-visible:ring-[3px]',
					active !== null && active !== row.rating && 'opacity-50'
				)}
			>
				<span class="text-muted-foreground tabular-nums">{row.rating}★</span>
				<span class="bg-muted h-2 overflow-hidden rounded-full">
					<span class="bg-chart-1 block h-full rounded-full" style:width="{row.percentage}%"></span>
				</span>
				<span class="text-ink-secondary text-right tabular-nums">
					{count(row.count)} · {row.percentage.toFixed(0)}%
				</span>
			</svelte:element>
		</li>
	{/each}
</ul>
