<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import { createQuery } from '@tanstack/svelte-query';
	import { page } from '$app/state';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import * as Card from '#lib/components/shadcn/card/index.js';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import CatalogDocument from '#lib/components/catalog/CatalogDocument.svelte';
	import Money from '#lib/components/data/Money.svelte';
	import MiniMap from '#lib/components/map/MiniMap.svelte';
	import EmptyState from '#lib/components/states/EmptyState.svelte';
	import ErrorState from '#lib/components/states/ErrorState.svelte';
	import BookingPanel from '#lib/features/properties/BookingPanel.svelte';
	import PropertyReviews from '#lib/features/properties/PropertyReviews.svelte';
	import { toApiError } from '#lib/api/errors.js';
	import { queries } from '#lib/api/queries.js';
	import { count } from '#lib/format.js';

	const id = $derived(page.params.id ?? '');
	const property = createQuery(() => queries.properties.detail(id));
	const amenities = createQuery(() => queries.properties.amenities(id));
</script>

<svelte:head>
	<title>{property.data?.title ?? 'Property'} · StaySpot</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="text-body-sm -mb-4">
	<ol class="flex flex-wrap items-center gap-1.5">
		<li><a href="/properties">Properties</a></li>
		<li aria-hidden="true" class="text-faint">/</li>
		<li aria-current="page" class="text-muted-foreground max-w-[60vw] truncate">{property.data?.title ?? '…'}</li>
	</ol>
</nav>

{#if property.isPending}
	<div class="flex flex-col gap-3" role="status">
		<span class="sr-only">Loading the property</span>
		<Skeleton class="h-10 w-2/3" />
		<Skeleton class="h-5 w-1/2" />
	</div>
{:else if property.isError}
	{#if toApiError(property.error).code === 'NOT_FOUND'}
		<EmptyState icon={SearchXIcon} title="Property not found" description="There is no property with this id. It may have been removed by a reseed.">
			<Button href="/properties">
				<ArrowLeftIcon data-icon="inline-start" />
				Back to properties
			</Button>
		</EmptyState>
	{:else}
		<ErrorState error={property.error} onretry={() => property.refetch()} retrying={property.isFetching} />
	{/if}
{:else}
	{@const p = property.data}
	<header class="flex flex-col gap-2">
		<h1 class="text-heading-2 sm:text-heading-1 text-balance">{p.title}</h1>
		<p class="text-body-md text-ink-secondary flex flex-wrap gap-x-3 gap-y-1">
			<span><Money value={p.base_price} class="text-foreground font-medium" /> / night</span>
			<span aria-hidden="true">·</span>
			<span>{count(p.summary.completed_bookings)} completed stays</span>
			<span aria-hidden="true">·</span>
			<span><Money value={p.summary.gross_revenue} whole /> earned</span>
		</p>
		<p class="text-caption text-muted-foreground">
			Stay and revenue numbers come from mv_property_summary, as of its last refresh.
		</p>
	</header>

	<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
		<div class="flex min-w-0 flex-col gap-6">
			<div class="grid items-start gap-6 md:grid-cols-2">
				<CatalogDocument query={amenities} />
				<PropertyReviews propertyId={id} />
			</div>
			<Card.Root>
				<Card.Header>
					<Card.Title>Location</Card.Title>
					<Card.Description>The property and a 5 km search area around it</Card.Description>
				</Card.Header>
				<Card.Content>
					<MiniMap lat={p.latitude} lng={p.longitude} label="Map of {p.title} and a 5 km area around it" class="h-72" />
				</Card.Content>
			</Card.Root>
		</div>
		<aside class="flex flex-col gap-4 lg:sticky lg:top-32" aria-label="Booking">
			<BookingPanel property={p} />
		</aside>
	</div>
{/if}
