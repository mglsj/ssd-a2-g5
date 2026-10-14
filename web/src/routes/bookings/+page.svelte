<script lang="ts">
	import CalendarXIcon from '@lucide/svelte/icons/calendar-x';
	import UserRoundIcon from '@lucide/svelte/icons/user-round';
	import { createQuery } from '@tanstack/svelte-query';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import EntityPicker from '#lib/components/data/EntityPicker.svelte';
	import FilterBar from '#lib/components/data/FilterBar.svelte';
	import Pager from '#lib/components/data/Pager.svelte';
	import EmptyState from '#lib/components/states/EmptyState.svelte';
	import QueryBoundary from '#lib/components/states/QueryBoundary.svelte';
	import BookingsTable from '#lib/features/bookings/BookingsTable.svelte';
	import StatusFilter from '#lib/features/bookings/StatusFilter.svelte';
	import { PAGE_SIZE, queries, type BookingListQuery } from '#lib/api/queries.js';
	import { count, statusLabel, type BookingStatus } from '#lib/format.js';
	import { getActor } from '#lib/state/actor.svelte.js';
	import { intParam, setParams, stringParam } from '#lib/url.js';

	const actor = getActor();
	const statuses = Object.keys(statusLabel) as BookingStatus[];

	// In guest mode the list is always the actor's own bookings.
	const guestId = $derived(actor.isManager ? stringParam('guest_id') || null : actor.guestId);
	const propertyId = $derived(stringParam('property_id') || null);
	const status = $derived(
		statuses.includes(stringParam('status') as BookingStatus) ? (stringParam('status') as BookingStatus) : null
	);
	const pageNumber = $derived(intParam('page', 1));

	const query = $derived.by(
		(): BookingListQuery => ({
			page: String(pageNumber),
			limit: String(PAGE_SIZE),
			...(guestId ? { guest_id: guestId } : {}),
			...(propertyId ? { property_id: propertyId } : {}),
			...(status ? { status } : {})
		})
	);

	const waitingForGuest = $derived(!actor.isManager && actor.guestId === null);
	const list = createQuery(() => ({ ...queries.bookings.list(query), enabled: !waitingForGuest }));

	const filtered = $derived((actor.isManager && guestId !== null) || propertyId !== null || status !== null);
	const title = $derived(actor.isManager ? 'Bookings' : 'My bookings');

	function clearFilters() {
		setParams({ guest_id: null, property_id: null, status: null });
	}
</script>

<svelte:head>
	<title>{title} · StaySpot</title>
</svelte:head>

<PageHeader
	{title}
	description={list.data
		? `${count(list.data.total)} ${list.data.total === 1 ? 'booking' : 'bookings'}${status ? ` ${statusLabel[status].toLowerCase()}` : ''}`
		: actor.isManager
			? 'Every stay, newest first'
			: 'Your stays, newest first'}
/>

{#if waitingForGuest}
	<EmptyState
		icon={UserRoundIcon}
		title="Pick a guest first"
		description="My bookings shows the stays of the guest you act as. Choose one with the guest picker in the header."
	/>
{:else}
	<FilterBar active={filtered} onclear={clearFilters} label="Filter bookings">
		{#if actor.isManager}
			<EntityPicker
				kind="guest"
				id="booking-guest"
				label="Guest"
				value={guestId}
				onchange={(id) => setParams({ guest_id: id })}
				class="w-full sm:w-64"
			/>
		{/if}
		<EntityPicker
			kind="property"
			id="booking-property"
			label="Property"
			value={propertyId}
			onchange={(id) => setParams({ property_id: id })}
			class="w-full sm:w-72"
		/>
		<StatusFilter value={status} onchange={(next) => setParams({ status: next })} />
	</FilterBar>

	<QueryBoundary query={list} isEmpty={(data) => data.items.length === 0}>
		{#snippet loading()}
			<div class="flex flex-col gap-2">
				{#each { length: 8 }, i (i)}<Skeleton class="h-12 w-full" />{/each}
			</div>
		{/snippet}
		{#snippet empty()}
			<EmptyState
				icon={CalendarXIcon}
				title={pageNumber > 1 ? 'No bookings on this page' : 'No bookings match'}
				description={filtered
					? 'Try another status, or clear the filters.'
					: actor.isManager
						? 'There are no bookings yet.'
						: 'This guest has not booked a stay yet. Pick a property to book one.'}
			>
				{#if pageNumber > 1}
					<Button variant="outline" onclick={() => setParams({ page: null })}>Go to page 1</Button>
				{/if}
				{#if filtered}
					<Button onclick={clearFilters}>Clear filters</Button>
				{:else if !actor.isManager}
					<Button href="/properties">Browse properties</Button>
				{/if}
			</EmptyState>
		{/snippet}
		{#snippet children(data)}
			<BookingsTable items={data.items} showGuest={actor.isManager} caption={title} />
			<Pager page={data.page} limit={data.limit} total={data.total} noun="bookings" />
		{/snippet}
	</QueryBoundary>
{/if}
