<script lang="ts">
	import DatabaseZapIcon from '@lucide/svelte/icons/database-zap';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import { Label } from '#lib/components/shadcn/label/index.js';
	import * as Select from '#lib/components/shadcn/select/index.js';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import { Spinner } from '#lib/components/shadcn/spinner/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import DataTable, { type Column } from '#lib/components/data/DataTable.svelte';
	import Money from '#lib/components/data/Money.svelte';
	import Pager from '#lib/components/data/Pager.svelte';
	import EmptyState from '#lib/components/states/EmptyState.svelte';
	import ErrorState from '#lib/components/states/ErrorState.svelte';
	import QueryBoundary from '#lib/components/states/QueryBoundary.svelte';
	import RankingCard from '#lib/features/analytics/RankingCard.svelte';
	import SummaryTiles from '#lib/features/analytics/SummaryTiles.svelte';
	import TrendCard from '#lib/features/analytics/TrendCard.svelte';
	import { toApiError } from '#lib/api/errors.js';
	import { keys, mutations, PAGE_SIZE, queries, type SummaryPage } from '#lib/api/queries.js';
	import { count, dateTime, relative } from '#lib/format.js';
	import { dateParam, enumParam, intParam, listParam, setParams } from '#lib/url.js';

	type Row = SummaryPage['items'][number];

	const queryClient = useQueryClient();

	const sorts = [
		{ value: 'gross_revenue', label: 'Gross revenue' },
		{ value: 'completed_bookings', label: 'Completed stays' },
		{ value: 'total_nights_booked', label: 'Nights booked' },
		{ value: 'title', label: 'Title' }
	] as const;
	type Sort = (typeof sorts)[number]['value'];

	// Chart, ranking and table each keep their own part of the URL.
	const propertyIds = $derived(listParam('property'));
	const from = $derived(dateParam('from'));
	const to = $derived(dateParam('to'));
	const view = $derived(enumParam('view', ['chart', 'table'] as const, 'chart'));
	const asOf = $derived(dateParam('as_of'));
	const sort = $derived(enumParam<Sort>('sort', sorts.map((s) => s.value), 'gross_revenue'));
	const pageNumber = $derived(intParam('page', 1));

	const summary = createQuery(() =>
		queries.analytics.summary({ sort, page: String(pageNumber), limit: String(PAGE_SIZE) })
	);

	// The totals before the last refresh, so the tiles can show what the refresh changed.
	let before = $state<SummaryPage['totals'] | null>(null);

	const refresh = createMutation(() => ({
		mutationFn: mutations.refreshSummary,
		onMutate: () => {
			before = summary.data?.totals ?? null;
		},
		onSuccess: async (result) => {
			// The summary feeds the tiles, the table and each property page's numbers.
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: keys.analytics.all }),
				queryClient.invalidateQueries({ queryKey: keys.properties.all })
			]);
			toast.success('Summary refreshed', {
				description: `REFRESH MATERIALIZED VIEW CONCURRENTLY finished at ${dateTime(result.refreshed_at)}.`
			});
		},
		onError: (error) => {
			before = null;
			toast.error('The refresh failed', { description: toApiError(error).message });
		}
	}));

	const changed = $derived(
		before !== null &&
			summary.data !== undefined &&
			JSON.stringify(before) !== JSON.stringify(summary.data.totals)
	);

	const columns: Column<Row>[] = [
		{ key: 'title', header: 'Property', cell: title, class: 'whitespace-normal min-w-48' },
		{ key: 'stays', header: 'Completed stays', cell: stays, align: 'right' },
		{ key: 'nights', header: 'Nights', cell: nights, align: 'right' },
		{ key: 'revenue', header: 'Gross revenue', cell: revenue, align: 'right' }
	];

	const sortLabel = $derived(sorts.find((s) => s.value === sort)?.label ?? 'Sort');
</script>

{#snippet title(row: Row)}{row.title}{/snippet}
{#snippet stays(row: Row)}{count(row.completed_bookings)}{/snippet}
{#snippet nights(row: Row)}{count(row.total_nights_booked)}{/snippet}
{#snippet revenue(row: Row)}<Money value={row.gross_revenue} whole />{/snippet}

<svelte:head>
	<title>Analytics · StaySpot</title>
</svelte:head>

<PageHeader title="Analytics" description="Revenue from completed bookings across all 1,000 properties.">
	{#snippet actions()}
		<div class="flex flex-col items-start gap-1.5 sm:items-end">
			<Button variant="outline" onclick={() => refresh.mutate()} disabled={refresh.isPending || summary.isPending}>
				{#if refresh.isPending}
					<Spinner data-icon="inline-start" />
					Refreshing
				{:else}
					<RefreshCwIcon data-icon="inline-start" />
					Refresh view
				{/if}
			</Button>
			<p class="text-caption text-muted-foreground" aria-live="polite">
				{#if summary.data?.refreshed_at}
					Summary refreshed
					<time datetime={summary.data.refreshed_at} title={dateTime(summary.data.refreshed_at)}>
						{relative(summary.data.refreshed_at)}
					</time>
				{:else if summary.data}
					Summary never refreshed
				{:else}
					&nbsp;
				{/if}
			</p>
		</div>
	{/snippet}
</PageHeader>

<section class="flex flex-col gap-3" aria-labelledby="totals-heading">
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<h2 id="totals-heading" class="text-title">Totals</h2>
		<p class="text-caption text-muted-foreground flex items-center gap-1.5">
			<DatabaseZapIcon class="size-3.5" aria-hidden="true" />
			mv_property_summary, a materialized view. New completed stays appear only after a refresh.
		</p>
	</div>
	{#if summary.isError && !summary.data}
		<ErrorState error={summary.error} onretry={() => summary.refetch()} retrying={summary.isFetching} />
	{:else}
		<SummaryTiles totals={summary.data?.totals} before={changed ? before : null} />
		{#if before !== null && !refresh.isPending && summary.data && !changed}
			<p class="text-caption text-muted-foreground">
				The refresh found no change. Complete a booking on the bookings page, then refresh again.
			</p>
		{/if}
	{/if}
</section>

<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
	<TrendCard
		{propertyIds}
		{from}
		{to}
		{view}
		onchange={(next) => setParams({ ...next, view: next.view === 'chart' ? null : next.view }, { keepPage: true })}
	/>
	<RankingCard {asOf} onchange={(value) => setParams({ as_of: value }, { keepPage: true })} />
</div>

<section class="flex flex-col gap-4" aria-labelledby="per-property-heading">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div class="flex flex-col gap-1">
			<h2 id="per-property-heading" class="text-title">Per property</h2>
			<p class="text-caption text-muted-foreground">Every row of mv_property_summary, as of its last refresh.</p>
		</div>
		<div class="flex flex-col gap-1.5">
			<Label for="summary-sort">Sort by</Label>
			<Select.Root type="single" value={sort} onValueChange={(value) => setParams({ sort: value === 'gross_revenue' ? null : value })}>
				<Select.Trigger id="summary-sort" class="w-44">{sortLabel}</Select.Trigger>
				<Select.Content>
					{#each sorts as option (option.value)}
						<Select.Item value={option.value} label={option.label} />
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	</div>
	<QueryBoundary query={summary} isEmpty={(data) => data.items.length === 0}>
		{#snippet loading()}
			<div class="flex flex-col gap-2">
				{#each { length: 8 }, i (i)}<Skeleton class="h-12 w-full" />{/each}
			</div>
		{/snippet}
		{#snippet empty()}
			<EmptyState
				title={pageNumber > 1 ? 'No rows on this page' : 'The summary is empty'}
				description={pageNumber > 1 ? 'This page is past the last property.' : 'Refresh the view to fill it.'}
			>
				{#if pageNumber > 1}
					<Button variant="outline" onclick={() => setParams({ page: null })}>Go to page 1</Button>
				{/if}
			</EmptyState>
		{/snippet}
		{#snippet children(data)}
			<DataTable
				items={data.items}
				{columns}
				caption="Per-property summary"
				getKey={(row) => row.property_id}
				rowHref={(row) => `/properties/${row.property_id}`}
			/>
			<Pager page={data.page} limit={data.limit} total={data.total} noun="properties" />
		{/snippet}
	</QueryBoundary>
</section>
