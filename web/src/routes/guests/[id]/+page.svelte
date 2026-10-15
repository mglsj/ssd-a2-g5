<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CalendarXIcon from '@lucide/svelte/icons/calendar-x';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import WalletIcon from '@lucide/svelte/icons/wallet';
	import { createQuery } from '@tanstack/svelte-query';
	import { page } from '$app/state';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import * as Card from '#lib/components/shadcn/card/index.js';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import Money from '#lib/components/data/Money.svelte';
	import Pager from '#lib/components/data/Pager.svelte';
	import StatusBadge from '#lib/components/data/StatusBadge.svelte';
	import EmptyState from '#lib/components/states/EmptyState.svelte';
	import ErrorState from '#lib/components/states/ErrorState.svelte';
	import QueryBoundary from '#lib/components/states/QueryBoundary.svelte';
	import BookingsTable from '#lib/features/bookings/BookingsTable.svelte';
	import ActionBadge from '#lib/features/wallet/ActionBadge.svelte';
	import { toApiError } from '#lib/api/errors.js';
	import { PAGE_SIZE, queries } from '#lib/api/queries.js';
	import { dateTime, statusLabel, type BookingStatus } from '#lib/format.js';
	import { getActor } from '#lib/state/actor.svelte.js';
	import { intParam } from '#lib/url.js';
	import AccessGate from '#lib/components/app/AccessGate.svelte';

	const actor = getActor();
	const id = $derived(page.params.id ?? '');
	const pageNumber = $derived(intParam('page', 1));

	const guest = createQuery(() => queries.guests.detail(id));
	const bookings = createQuery(() =>
		queries.bookings.list({ guest_id: id, page: String(pageNumber), limit: String(PAGE_SIZE) })
	);

	const statuses = Object.keys(statusLabel) as BookingStatus[];
</script>

<svelte:head>
	<title>{guest.data?.name ?? 'Guest'} · StaySpot</title>
</svelte:head>

{#if !actor.isManager}
	<AccessGate kind="manager" what="guest profiles" />
{:else}
	{#if guest.isPending}
		<div class="flex flex-col gap-4" role="status">
			<span class="sr-only">Loading the guest</span>
			<Skeleton class="h-10 w-1/2" />
			<div class="grid gap-4 md:grid-cols-3">
				{#each { length: 3 }, i (i)}<Skeleton class="h-40" />{/each}
			</div>
		</div>
	{:else if guest.isError}
		{#if toApiError(guest.error).code === 'NOT_FOUND'}
			<EmptyState icon={SearchXIcon} title="Guest not found" description="This guest does not exist, or the link is out of date.">
				<Button href="/guests">
					<ArrowLeftIcon data-icon="inline-start" />
					Back to guests
				</Button>
			</EmptyState>
		{:else}
			<ErrorState error={guest.error} onretry={() => guest.refetch()} retrying={guest.isFetching} />
		{/if}
	{:else}
		{@const g = guest.data}
		<PageHeader title={g.name} eyebrow="Guest">
			{#snippet actions()}
				<Button href="/guests/{id}/wallet">
					<WalletIcon data-icon="inline-start" />
					Wallet history
				</Button>
			{/snippet}
		</PageHeader>

		<div class="grid gap-4 md:grid-cols-3">
			<Card.Root>
				<Card.Header>
					<Card.Description>Wallet balance</Card.Description>
					<Card.Title class="text-heading-2"><Money value={g.wallet_balance} /></Card.Title>
				</Card.Header>
				<Card.Content class="text-body-sm flex flex-col gap-1">
					{#if g.latest_audit}
						<p class="text-muted-foreground">Latest wallet change</p>
						<p class="flex flex-wrap items-center gap-2">
							<ActionBadge action={g.latest_audit.action_type} />
							<Money
								value={g.latest_audit.action_type === 'CREDIT' ? g.latest_audit.amount_changed : `-${g.latest_audit.amount_changed}`}
								signed
							/>
						</p>
						<p class="text-caption text-muted-foreground">
							{dateTime(g.latest_audit.timestamp)} · balance after <Money value={g.latest_audit.balance_after} />
						</p>
					{:else}
						<p class="text-muted-foreground">No wallet activity yet.</p>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Description>Active stay</Card.Description>
					<Card.Title>{g.active_booking ? g.active_booking.property_title : 'Not checked in'}</Card.Title>
				</Card.Header>
				<Card.Content class="text-body-sm flex flex-col gap-2">
					{#if g.active_booking}
						<StatusBadge status="CHECKED_IN" />
						<a href="/bookings/{g.active_booking.id}" class="w-fit">Open this booking</a>
						<p class="text-caption text-muted-foreground">A guest can be checked in to one stay at a time.</p>
					{:else}
						<p class="text-muted-foreground">This guest is not checked in anywhere right now.</p>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Description>Bookings by status</Card.Description>
				</Card.Header>
				<Card.Content>
					<dl class="flex flex-col gap-2">
						{#each statuses as status (status)}
							<div class="flex items-center justify-between gap-2">
								<dt><StatusBadge {status} /></dt>
								<dd class="text-body-md font-medium tabular-nums">{g.booking_counts[status]}</dd>
							</div>
						{/each}
					</dl>
				</Card.Content>
			</Card.Root>
		</div>

		<section class="flex flex-col gap-4" aria-labelledby="guest-bookings">
			<h2 id="guest-bookings" class="text-heading-3">Bookings</h2>
			<QueryBoundary query={bookings} isEmpty={(data) => data.items.length === 0}>
				{#snippet loading()}
					<div class="flex flex-col gap-2">
						{#each { length: 5 }, i (i)}<Skeleton class="h-12 w-full" />{/each}
					</div>
				{/snippet}
				{#snippet empty()}
					<EmptyState icon={CalendarXIcon} title="No bookings yet" description="This guest has not booked a stay.">
						<Button href="/properties">Browse properties</Button>
					</EmptyState>
				{/snippet}
				{#snippet children(data)}
					<BookingsTable items={data.items} showGuest={false} caption="Bookings of {g.name}" />
					<Pager page={data.page} limit={data.limit} total={data.total} noun="bookings" />
				{/snippet}
			</QueryBoundary>
		</section>
	{/if}
{/if}
