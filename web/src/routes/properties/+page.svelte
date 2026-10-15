<script lang="ts">
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import { createQuery } from '@tanstack/svelte-query';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import { Label } from '#lib/components/shadcn/label/index.js';
	import * as Select from '#lib/components/shadcn/select/index.js';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import { Toggle } from '#lib/components/shadcn/toggle/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import DebouncedInput from '#lib/components/data/DebouncedInput.svelte';
	import FilterBar from '#lib/components/data/FilterBar.svelte';
	import Pager from '#lib/components/data/Pager.svelte';
	import EmptyState from '#lib/components/states/EmptyState.svelte';
	import QueryBoundary from '#lib/components/states/QueryBoundary.svelte';
	import PropertyCard from '#lib/features/properties/PropertyCard.svelte';
	import { unsplashUrl } from '#lib/features/properties/photos.js';
	import { PAGE_SIZE, queries, type PropertyListQuery } from '#lib/api/queries.js';
	import { count } from '#lib/format.js';
	import { IIIT } from '#lib/map/theme.svelte.js';
	import { enumParam, intParam, setParams, stringParam } from '#lib/url.js';
	import { page } from '$app/state';
	import { getActor } from '#lib/state/actor.svelte.js';

	const RADIUS = 5000;
	const actor = getActor();

	const sorts = [
		{ value: 'title', label: 'Title' },
		{ value: 'price_asc', label: 'Lowest price' },
		{ value: 'price_desc', label: 'Highest price' },
		{ value: 'revenue', label: 'Most revenue' },
		{ value: 'distance', label: 'Nearest to IIIT' }
	] as const;
	type Sort = (typeof sorts)[number]['value'];

	const q = $derived(stringParam('q'));
	const minPrice = $derived(stringParam('min_price'));
	const maxPrice = $derived(stringParam('max_price'));
	const near = $derived(page.url.searchParams.get('near') === 'iiit');
	const requestedSort = $derived(enumParam<Sort>('sort', sorts.map((s) => s.value), near ? 'distance' : 'title'));
	// Distance needs a centre, so without "Near IIIT" it falls back to title. Revenue is for managers.
	const sort = $derived(
		(requestedSort === 'distance' && !near) || (requestedSort === 'revenue' && !actor.isManager) ? 'title' : requestedSort
	);
	const sortOptions = $derived(sorts.filter((s) => s.value !== 'revenue' || actor.isManager));
	const pageNumber = $derived(intParam('page', 1));

	function priceError(value: string): string | undefined {
		if (value === '') return undefined;
		const amount = Number(value);
		return Number.isFinite(amount) && amount >= 0 ? undefined : 'Enter an amount of 0 or more';
	}

	const minError = $derived(priceError(minPrice));
	const maxError = $derived(
		priceError(maxPrice) ??
			(minPrice !== '' && maxPrice !== '' && !minError && Number(minPrice) > Number(maxPrice)
				? 'Must be at least the minimum price'
				: undefined)
	);

	const query = $derived.by((): PropertyListQuery => ({
		q,
		sort,
		page: String(pageNumber),
		limit: String(PAGE_SIZE),
		...(minPrice && !minError ? { min_price: minPrice } : {}),
		...(maxPrice && !maxError ? { max_price: maxPrice } : {}),
		...(near ? { lat: String(IIIT.lat), lng: String(IIIT.lng), radius: String(RADIUS) } : {})
	}));

	const list = createQuery(() => queries.properties.list(query));

	const filtered = $derived(q !== '' || minPrice !== '' || maxPrice !== '' || near);
	const sortLabel = $derived(sorts.find((s) => s.value === sort)?.label ?? 'Sort');

	function clearFilters() {
		setParams({ q: null, min_price: null, max_price: null, near: null, sort: null });
	}

	function toggleNear(pressed: boolean) {
		// Turning "Near IIIT" on sorts by distance. Turning it off drops a distance sort.
		setParams({ near: pressed ? 'iiit' : null, sort: pressed ? 'distance' : sort === 'distance' ? null : sort });
	}
</script>

<svelte:head>
	<title>Properties · StaySpot</title>
</svelte:head>

<PageHeader
	title="Properties"
	description={list.data
		? filtered
			? `${count(list.data.total)} stays match`
			: `${count(list.data.total)} stays across Hyderabad`
		: 'Stays across Hyderabad'}
/>

<FilterBar active={filtered} onclear={clearFilters} label="Filter properties">
	<DebouncedInput
		id="property-search"
		label="Search"
		search
		placeholder="Search titles, e.g. Taj…"
		value={q}
		onchange={(value) => setParams({ q: value })}
		class="w-full sm:w-72"
	/>
	<DebouncedInput
		id="min-price"
		label="Min price"
		prefix="₹"
		inputmode="decimal"
		placeholder="0"
		value={minPrice}
		error={minError}
		onchange={(value) => setParams({ min_price: value })}
		class="w-[calc(50%-0.375rem)] sm:w-32"
	/>
	<DebouncedInput
		id="max-price"
		label="Max price"
		prefix="₹"
		inputmode="decimal"
		placeholder="Any"
		value={maxPrice}
		error={maxError}
		onchange={(value) => setParams({ max_price: value })}
		class="w-[calc(50%-0.375rem)] sm:w-32"
	/>
	<div class="flex flex-col gap-1.5">
		<span class="text-sm font-medium select-none" aria-hidden="true">Area</span>
		<Toggle variant="outline" pressed={near} onPressedChange={toggleNear} aria-label="Only stays within 5 km of IIIT Hyderabad">
			<MapPinIcon data-icon="inline-start" />
			Near IIIT · 5 km
		</Toggle>
	</div>
	<div class="flex flex-col gap-1.5">
		<Label for="property-sort">Sort by</Label>
		<Select.Root type="single" value={sort} onValueChange={(value) => setParams({ sort: value === 'title' ? null : value })}>
			<Select.Trigger id="property-sort" class="w-48">{sortLabel}</Select.Trigger>
			<Select.Content>
				{#each sortOptions as option (option.value)}
					<Select.Item value={option.value} label={option.label} disabled={option.value === 'distance' && !near}>
						{option.label}
						{#if option.value === 'distance' && !near}
							<span class="text-caption text-muted-foreground ml-auto">Turn on Near IIIT</span>
						{/if}
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>
</FilterBar>

<QueryBoundary query={list} isEmpty={(data) => data.items.length === 0}>
	{#snippet loading()}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each { length: 6 }, i (i)}
				<div class="bg-card ring-border overflow-hidden rounded-lg ring-1">
					<Skeleton class="aspect-[5/2] rounded-none" />
					<div class="flex flex-col gap-2 p-4">
						<Skeleton class="h-5 w-3/4" />
						<Skeleton class="h-4 w-1/3" />
					</div>
				</div>
			{/each}
		</div>
	{/snippet}
	{#snippet empty()}
		<EmptyState
			icon={SearchXIcon}
			title="No stays match"
			description={pageNumber > 1 ? 'This page is past the last result.' : 'Try a wider price range or a different title.'}
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
		<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Properties">
			{#each data.items as property, i (property.id)}
				<li class="flex"><PropertyCard {property} eager={i < 3} /></li>
			{/each}
		</ul>
		<Pager page={data.page} limit={data.limit} total={data.total} noun="stays" />
		<p class="text-caption text-muted-foreground">
			Photos are illustrative, from <a href={unsplashUrl} target="_blank" rel="noopener noreferrer">Unsplash</a>. Each
			property page credits its photographer.
		</p>
	{/snippet}
</QueryBoundary>
