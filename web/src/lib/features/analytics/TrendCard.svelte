<script lang="ts">
	import ChartLineIcon from '@lucide/svelte/icons/chart-line';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import { createQuery } from '@tanstack/svelte-query';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import * as Card from '#lib/components/shadcn/card/index.js';
	import { Input } from '#lib/components/shadcn/input/index.js';
	import { Label } from '#lib/components/shadcn/label/index.js';
	import { ScrollArea } from '#lib/components/shadcn/scroll-area/index.js';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import * as Table from '#lib/components/shadcn/table/index.js';
	import * as Tabs from '#lib/components/shadcn/tabs/index.js';
	import EmptyState from '#lib/components/states/EmptyState.svelte';
	import QueryBoundary from '#lib/components/states/QueryBoundary.svelte';
	import { queries, type MovingAverageQuery } from '#lib/api/queries.js';
	import { longDay, rupees } from '#lib/format.js';
	import MovingAverageChart, { type ChartSeries } from './MovingAverageChart.svelte';
	import PropertyMultiPicker from './PropertyMultiPicker.svelte';

	type Props = {
		/** Chosen property ids. Empty means the API's default, the top 5 of the ranking. */
		propertyIds: string[];
		from: string;
		to: string;
		view: 'chart' | 'table';
		onchange: (next: { property?: string[]; from?: string; to?: string; view?: 'chart' | 'table' }) => void;
	};

	let { propertyIds, from, to, view, onchange }: Props = $props();

	const MAX_DAYS = 366;
	const dayMs = 86_400_000;

	const rangeError = $derived.by(() => {
		if (from && to && from > to) return 'The start date is after the end date';
		if (from && to && (Date.parse(to) - Date.parse(from)) / dayMs > MAX_DAYS) return `Pick at most ${MAX_DAYS} days`;
		return undefined;
	});

	const query = $derived.by(
		(): MovingAverageQuery => ({
			...(propertyIds.length ? { property_id: propertyIds } : {}),
			...(from && !rangeError ? { from } : {}),
			...(to && !rangeError ? { to } : {})
		})
	);
	const trend = createQuery(() => queries.analytics.movingAverage(query));

	// Colour follows the property, never its position: a property keeps its slot while it
	// stays on the chart, and a newly added one takes the first free slot.
	// A plain Map on purpose: it is a memo written inside the $derived below, and a reactive
	// SvelteMap written there would be a state mutation during derivation.
	const slots = new Map<string, number>();
	const series = $derived.by((): ChartSeries[] => {
		const data = trend.data?.series ?? [];
		const ids = new Set(data.map((s) => s.property_id));
		for (const id of [...slots.keys()]) if (!ids.has(id)) slots.delete(id);
		for (const s of data) {
			if (slots.has(s.property_id)) continue;
			const used = new Set(slots.values());
			slots.set(s.property_id, [1, 2, 3, 4, 5].find((slot) => !used.has(slot)) ?? 1);
		}
		return data.map((s) => ({
			key: s.property_id,
			label: s.title,
			color: `--chart-${slots.get(s.property_id)}`,
			points: s.points.map((p) => ({ day: p.day, value: Number(p.moving_avg_7d) }))
		}));
	});

	const allZero = $derived(series.every((s) => s.points.every((p) => p.value === 0)));
	const custom = $derived(propertyIds.length > 0);
</script>

<Card.Root class="h-full">
	<Card.Header>
		<Card.Title>Revenue trend</Card.Title>
		<Card.Description>
			Average daily revenue over the previous 7 days{custom ? '' : ', for the top 5 properties'}
		</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-4">
		<div class="flex flex-col gap-3">
			<PropertyMultiPicker
				selected={series.map((s) => ({ id: s.key, title: s.label, color: s.color }))}
				onchange={(ids) => onchange({ property: ids })}
			/>
			<div class="flex flex-wrap items-end gap-3">
				<div class="flex flex-col gap-1.5">
					<Label for="trend-from">From</Label>
					<Input
						id="trend-from"
						type="date"
						class="w-40"
						value={from || trend.data?.from || ''}
						onchange={(event) => onchange({ from: event.currentTarget.value })}
						aria-invalid={rangeError ? 'true' : undefined}
						aria-describedby={rangeError ? 'trend-range-error' : undefined}
					/>
				</div>
				<div class="flex flex-col gap-1.5">
					<Label for="trend-to">To</Label>
					<Input
						id="trend-to"
						type="date"
						class="w-40"
						value={to || trend.data?.to || ''}
						onchange={(event) => onchange({ to: event.currentTarget.value })}
						aria-invalid={rangeError ? 'true' : undefined}
					/>
				</div>
				{#if custom || from || to}
					<Button variant="ghost" onclick={() => onchange({ property: [], from: '', to: '' })}>
						<RotateCcwIcon data-icon="inline-start" />
						Top 5, last 90 days
					</Button>
				{/if}
				<Tabs.Root value={view} onValueChange={(value) => onchange({ view: value as 'chart' | 'table' })} class="ml-auto">
					<Tabs.List aria-label="Show the trend as">
						<Tabs.Trigger value="chart">Chart</Tabs.Trigger>
						<Tabs.Trigger value="table">Table</Tabs.Trigger>
					</Tabs.List>
				</Tabs.Root>
			</div>
			{#if rangeError}
				<p id="trend-range-error" class="text-caption text-destructive">{rangeError}</p>
			{/if}
		</div>

		<QueryBoundary query={trend} isEmpty={(data) => data.series.length === 0}>
			{#snippet loading()}
				<Skeleton class="h-[340px] w-full" />
			{/snippet}
			{#snippet empty()}
				<EmptyState icon={ChartLineIcon} title="No revenue to chart" description="No property has completed bookings in this range." class="p-6" />
			{/snippet}
			{#snippet children(data)}
				{#if allZero}
					<p class="text-caption text-muted-foreground">
						None of these properties earned revenue between {longDay(data.from)} and {longDay(data.to)}.
					</p>
				{/if}
				{#if view === 'chart'}
					<MovingAverageChart
						{series}
						legend={false}
						label="Revenue trend for {series.length} properties, {longDay(data.from)} to {longDay(data.to)}"
					/>
				{:else}
					<ScrollArea class="h-[340px] rounded-md border">
						<Table.Root>
							<Table.Caption class="sr-only">Revenue trend per day</Table.Caption>
							<Table.Header class="bg-card sticky top-0 z-10">
								<Table.Row>
									<Table.Head>Day</Table.Head>
									{#each series as s (s.key)}
										<Table.Head class="max-w-40 text-right">
											<span class="inline-flex max-w-full items-center justify-end gap-1.5">
												<span class="h-0.5 w-3 shrink-0 rounded-full" style:background-color="var({s.color})" aria-hidden="true"></span>
												<span class="truncate" title={s.label}>{s.label}</span>
											</span>
										</Table.Head>
									{/each}
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each [...(series[0]?.points ?? [])].reverse() as point, i (point.day)}
									{@const index = (series[0]?.points.length ?? 0) - 1 - i}
									<Table.Row>
										<Table.Cell class="whitespace-nowrap">{longDay(point.day)}</Table.Cell>
										{#each series as s (s.key)}
											<Table.Cell class="text-right tabular-nums">{rupees(s.points[index]?.value ?? 0, { whole: true })}</Table.Cell>
										{/each}
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</ScrollArea>
				{/if}
			{/snippet}
		</QueryBoundary>
	</Card.Content>
</Card.Root>
