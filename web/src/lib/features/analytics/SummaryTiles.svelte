<script lang="ts">
	import * as Card from '#lib/components/shadcn/card/index.js';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import type { SummaryPage } from '#lib/api/queries.js';
	import { count, countCompact, rupees, rupeesCompact, toPaise, fromPaise } from '#lib/format.js';

	type Totals = SummaryPage['totals'];

	type Props = {
		totals: Totals | undefined;
		/** The totals before the last refresh, to show what the refresh changed. */
		before?: Totals | null;
	};

	let { totals, before = null }: Props = $props();

	const tiles = $derived.by(() => {
		if (!totals) return [];
		const delta = (now: number, then: number | undefined) => (then === undefined ? 0 : now - then);
		const revenueDelta = before ? toPaise(totals.gross_revenue) - toPaise(before.gross_revenue) : 0;
		return [
			{
				label: 'Properties',
				value: count(totals.properties),
				full: null,
				change: delta(totals.properties, before?.properties),
				changeText: (d: number) => count(d)
			},
			{
				label: 'Completed stays',
				value: countCompact(totals.completed_bookings),
				full: count(totals.completed_bookings),
				change: delta(totals.completed_bookings, before?.completed_bookings),
				changeText: (d: number) => count(d)
			},
			{
				label: 'Nights booked',
				value: countCompact(totals.total_nights_booked),
				full: count(totals.total_nights_booked),
				change: delta(totals.total_nights_booked, before?.total_nights_booked),
				changeText: (d: number) => count(d)
			},
			{
				label: 'Gross revenue',
				value: rupeesCompact(totals.gross_revenue),
				full: rupees(totals.gross_revenue),
				change: revenueDelta,
				changeText: () => rupees(fromPaise(Math.abs(revenueDelta)))
			}
		];
	});
</script>

<ul class="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Totals">
	{#if !totals}
		{#each { length: 4 }, i (i)}
			<li><Skeleton class="h-28 rounded-lg" /></li>
		{/each}
	{:else}
		{#each tiles as tile (tile.label)}
			<li>
				<Card.Root size="sm" class="h-full">
					<Card.Content class="flex flex-col gap-1">
						<p class="text-caption text-muted-foreground">{tile.label}</p>
						<p class="text-heading-2">{tile.value}</p>
						{#if tile.full}
							<p class="text-caption text-muted-foreground tabular-nums">{tile.full}</p>
						{/if}
						{#if before && tile.change !== 0}
							<p class="text-caption text-success font-medium">
								{tile.change > 0 ? '+' : '−'}{tile.changeText(Math.abs(tile.change))} since the refresh
							</p>
						{/if}
					</Card.Content>
				</Card.Root>
			</li>
		{/each}
	{/if}
</ul>
