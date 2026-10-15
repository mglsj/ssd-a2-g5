<script lang="ts">
	import UsersIcon from '@lucide/svelte/icons/users';
	import { createQuery } from '@tanstack/svelte-query';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import { Label } from '#lib/components/shadcn/label/index.js';
	import * as Select from '#lib/components/shadcn/select/index.js';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import * as ToggleGroup from '#lib/components/shadcn/toggle-group/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import DataTable, { type Column } from '#lib/components/data/DataTable.svelte';
	import DebouncedInput from '#lib/components/data/DebouncedInput.svelte';
	import FilterBar from '#lib/components/data/FilterBar.svelte';
	import Money from '#lib/components/data/Money.svelte';
	import Pager from '#lib/components/data/Pager.svelte';
	import EmptyState from '#lib/components/states/EmptyState.svelte';
	import QueryBoundary from '#lib/components/states/QueryBoundary.svelte';
	import { PAGE_SIZE, queries, type GuestListQuery } from '#lib/api/queries.js';
	import { count } from '#lib/format.js';
	import { getActor } from '#lib/state/actor.svelte.js';
	import { enumParam, intParam, setParams, stringParam } from '#lib/url.js';
	import AccessGate from '#lib/components/app/AccessGate.svelte';

	type Guest = { id: string; name: string; wallet_balance: string };

	const actor = getActor();

	const sorts = [
		{ value: 'name', label: 'Name' },
		{ value: 'balance_desc', label: 'Highest balance' },
		{ value: 'balance_asc', label: 'Lowest balance' }
	] as const;
	type Sort = (typeof sorts)[number]['value'];

	const stays = ['all', 'true', 'false'] as const;

	const q = $derived(stringParam('q'));
	const sort = $derived(enumParam<Sort>('sort', sorts.map((s) => s.value), 'name'));
	const stay = $derived(enumParam('has_active_stay', stays, 'all'));
	const pageNumber = $derived(intParam('page', 1));

	const query = $derived.by(
		(): GuestListQuery => ({
			q,
			sort,
			page: String(pageNumber),
			limit: String(PAGE_SIZE),
			...(stay !== 'all' ? { has_active_stay: stay } : {})
		})
	);

	const list = createQuery(() => queries.guests.list(query));
	const filtered = $derived(q !== '' || stay !== 'all');
	const sortLabel = $derived(sorts.find((s) => s.value === sort)?.label ?? 'Sort');

	const columns: Column<Guest>[] = [
		{ key: 'name', header: 'Name', cell: name },
		{ key: 'balance', header: 'Wallet balance', cell: balance, align: 'right' }
	];

	function clearFilters() {
		setParams({ q: null, has_active_stay: null });
	}
</script>

{#snippet name(g: Guest)}
	{g.name}
{/snippet}
{#snippet balance(g: Guest)}<Money value={g.wallet_balance} />{/snippet}

<svelte:head>
	<title>Guests · StaySpot</title>
</svelte:head>

{#if !actor.isManager}
	<AccessGate kind="manager" what="the guest list" />
{:else}
	<PageHeader
		title="Guests"
		description={list.data ? `${count(list.data.total)} ${filtered ? 'guests match' : 'guests'}` : 'Everyone with a StaySpot wallet'}
	/>

	<FilterBar active={filtered} onclear={clearFilters} label="Filter guests">
		<DebouncedInput
			id="guest-search"
			label="Search"
			search
			placeholder="Search by name, e.g. Ray…"
			value={q}
			onchange={(value) => setParams({ q: value })}
			class="w-full sm:w-72"
		/>
		<div class="flex flex-col gap-1.5">
			<Label for="guest-sort">Sort by</Label>
			<Select.Root type="single" value={sort} onValueChange={(value) => setParams({ sort: value === 'name' ? null : value })}>
				<Select.Trigger id="guest-sort" class="w-44">{sortLabel}</Select.Trigger>
				<Select.Content>
					{#each sorts as option (option.value)}
						<Select.Item value={option.value} label={option.label} />
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
		<div class="flex flex-col gap-1.5">
			<span id="stay-filter-label" class="text-sm font-medium select-none">Active stay</span>
			<ToggleGroup.Root
				type="single"
				variant="outline"
				aria-labelledby="stay-filter-label"
				bind:value={
					() => stay,
					(next) => {
						if (next) setParams({ has_active_stay: next === 'all' ? null : next });
					}
				}
			>
				{#each [['all', 'Everyone'], ['true', 'Checked in'], ['false', 'Not checked in']] as [value, label] (value)}
					<ToggleGroup.Item
						{value}
						class="data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:hover:bg-foreground/90 data-[state=on]:hover:text-background text-muted-foreground px-3"
					>
						{label}
					</ToggleGroup.Item>
				{/each}
			</ToggleGroup.Root>
		</div>
	</FilterBar>

	<QueryBoundary query={list} isEmpty={(data) => data.items.length === 0}>
		{#snippet loading()}
			<div class="flex flex-col gap-2">
				{#each { length: 8 }, i (i)}<Skeleton class="h-12 w-full" />{/each}
			</div>
		{/snippet}
		{#snippet empty()}
			<EmptyState
				icon={UsersIcon}
				title={pageNumber > 1 ? 'No guests on this page' : 'No guests match'}
				description="Try a shorter name, or clear the filters."
			>
				{#if pageNumber > 1}
					<Button variant="outline" onclick={() => setParams({ page: null })}>Go to page 1</Button>
				{/if}
				{#if filtered}
					<Button onclick={clearFilters}>Clear filters</Button>
				{/if}
			</EmptyState>
		{/snippet}
		{#snippet children(data)}
			<DataTable
				items={data.items}
				{columns}
				caption="Guests"
				getKey={(g) => g.id}
				rowHref={(g) => `/guests/${g.id}`}
			/>
			<Pager page={data.page} limit={data.limit} total={data.total} noun="guests" />
		{/snippet}
	</QueryBoundary>
{/if}
