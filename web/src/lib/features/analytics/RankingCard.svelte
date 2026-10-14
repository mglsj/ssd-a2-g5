<script lang="ts">
	import TrophyIcon from '@lucide/svelte/icons/trophy';
	import { createQuery } from '@tanstack/svelte-query';
	import * as Card from '#lib/components/shadcn/card/index.js';
	import { Input } from '#lib/components/shadcn/input/index.js';
	import { Label } from '#lib/components/shadcn/label/index.js';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import * as Table from '#lib/components/shadcn/table/index.js';
	import EmptyState from '#lib/components/states/EmptyState.svelte';
	import QueryBoundary from '#lib/components/states/QueryBoundary.svelte';
	import { queries } from '#lib/api/queries.js';
	import { longDay, rupees } from '#lib/format.js';

	type Props = {
		/** YYYY-MM-DD, or empty for the API's default: the latest day with a completed booking. */
		asOf: string;
		onchange: (asOf: string) => void;
		limit?: number;
	};

	let { asOf, onchange, limit = 10 }: Props = $props();

	const ranking = createQuery(() => queries.analytics.rank({ limit: String(limit), ...(asOf ? { as_of: asOf } : {}) }));

	// A rank shared with a neighbour is a tie. DENSE_RANK leaves no gap after it.
	const tied = $derived.by(() => {
		const items = ranking.data?.items ?? [];
		return new Set(
			items.filter((row, i) => items[i - 1]?.revenue_rank === row.revenue_rank || items[i + 1]?.revenue_rank === row.revenue_rank).map((r) => r.property_id)
		);
	});
</script>

<Card.Root class="h-full">
	<Card.Header>
		<Card.Title>Revenue ranking</Card.Title>
		<Card.Description>fn_property_revenue_rank, DENSE_RANK() over the 7-day average</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<Label for="rank-as-of">As of</Label>
			<Input
				id="rank-as-of"
				type="date"
				class="w-44"
				value={asOf || ranking.data?.as_of || ''}
				onchange={(event) => onchange(event.currentTarget.value)}
			/>
		</div>

		<QueryBoundary query={ranking} isEmpty={(data) => data.items.length === 0}>
			{#snippet loading()}
				<div class="flex flex-col gap-2">
					{#each { length: 6 }, i (i)}<Skeleton class="h-8 w-full" />{/each}
				</div>
			{/snippet}
			{#snippet empty()}
				<EmptyState icon={TrophyIcon} title="Nothing to rank" description="No property earned revenue in the 7 days up to this date." class="p-6" />
			{/snippet}
			{#snippet children(data)}
				<div class="-mx-2 overflow-x-auto">
					<Table.Root>
						<Table.Caption class="text-caption mt-3 text-left">
							Ranked on {longDay(data.as_of)}. Ties share a rank and the next rank follows without a gap.
						</Table.Caption>
						<Table.Header>
							<Table.Row>
								<Table.Head class="w-14">Rank</Table.Head>
								<Table.Head>Property</Table.Head>
								<Table.Head class="text-right">7-day avg</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each data.items as row (row.property_id)}
								<Table.Row>
									<Table.Cell class="tabular-nums">
										{row.revenue_rank}
										{#if tied.has(row.property_id)}
											<span class="text-muted-foreground text-eyebrow ml-1">tie</span>
										{/if}
									</Table.Cell>
									<Table.Cell class="max-w-0 truncate">
										<a href="/properties/{row.property_id}" title={row.title}>{row.title}</a>
									</Table.Cell>
									<Table.Cell class="text-right tabular-nums">{rupees(row.moving_avg_7d, { whole: true })}</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			{/snippet}
		</QueryBoundary>
	</Card.Content>
</Card.Root>
