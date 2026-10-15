<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import { createQuery } from '@tanstack/svelte-query';
	import { page } from '$app/state';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import * as Card from '#lib/components/shadcn/card/index.js';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import Money from '#lib/components/data/Money.svelte';
	import StatusBadge from '#lib/components/data/StatusBadge.svelte';
	import EmptyState from '#lib/components/states/EmptyState.svelte';
	import ErrorState from '#lib/components/states/ErrorState.svelte';
	import ActiveStayCallout, { type Conflict } from '#lib/features/bookings/ActiveStayCallout.svelte';
	import StatusAction from '#lib/features/bookings/StatusAction.svelte';
	import StatusTimeline from '#lib/features/bookings/StatusTimeline.svelte';
	import { toApiError } from '#lib/api/errors.js';
	import { queries } from '#lib/api/queries.js';
	import { dateTime } from '#lib/format.js';
	import { getActor } from '#lib/state/actor.svelte.js';
	import AccessGate from '#lib/components/app/AccessGate.svelte';

	const id = $derived(page.params.id ?? '');
	const booking = createQuery(() => queries.bookings.detail(id));
	let conflict = $state<Conflict | null>(null);

	const actor = getActor();
	// A guest sees only their own bookings. Anyone else's reads as not found.
	const hidden = $derived(!actor.isManager && booking.data !== undefined && booking.data.guest_id !== actor.guestId);
</script>

<svelte:head>
	<title>{booking.data && !hidden ? `Booking at ${booking.data.property_title}` : 'Booking'} · StaySpot</title>
</svelte:head>

{#if !actor.isManager && !actor.signedIn}
	<AccessGate kind="login" what="this booking" />
{:else}
	<nav aria-label="Breadcrumb" class="text-body-sm -mb-4">
		<ol class="flex flex-wrap items-center gap-1.5">
			<li><a href="/bookings">{actor.isManager ? 'Bookings' : 'My bookings'}</a></li>
			<li aria-hidden="true" class="text-faint">/</li>
			<li aria-current="page" class="text-muted-foreground font-mono text-xs">{id.slice(0, 8).toUpperCase()}</li>
		</ol>
	</nav>

	{#if booking.isPending}
		<div class="flex flex-col gap-4" role="status">
			<span class="sr-only">Loading the booking</span>
			<Skeleton class="h-10 w-1/2" />
			<Skeleton class="h-48" />
		</div>
	{:else if hidden || booking.isError}
		{#if hidden || toApiError(booking.error).code === 'NOT_FOUND'}
			<EmptyState icon={SearchXIcon} title="Booking not found" description="This booking does not exist, or it belongs to another account.">
				<Button href="/bookings">
					<ArrowLeftIcon data-icon="inline-start" />
					Back to bookings
				</Button>
			</EmptyState>
		{:else}
			<ErrorState error={booking.error} onretry={() => booking.refetch()} retrying={booking.isFetching} />
		{/if}
	{:else}
		{@const b = booking.data}
		<PageHeader title={b.property_title} eyebrow="Booking">
			<div><StatusBadge status={b.status} /></div>
		</PageHeader>

		<!-- The page is reused when "Open that stay" opens another booking, so show it only where it was raised. -->
		{#if conflict && conflict.attempted.id === id}
			<ActiveStayCallout {conflict} ondismiss={() => (conflict = null)} />
		{/if}

		<div class="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
			<Card.Root>
				<Card.Header>
					<Card.Title>Details</Card.Title>
				</Card.Header>
				<Card.Content>
					<dl class="text-body-sm grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
						<dt class="text-muted-foreground">Guest</dt>
						<dd>
							{#if actor.isManager}<a href="/guests/{b.guest_id}">{b.guest_name}</a>{:else}{b.guest_name}{/if}
						</dd>
						<dt class="text-muted-foreground">Property</dt>
						<dd><a href="/properties/{b.property_id}">{b.property_title}</a></dd>
						<dt class="text-muted-foreground">Nights</dt>
						<dd class="tabular-nums">{b.nights}</dd>
						<dt class="text-muted-foreground">Total paid</dt>
						<dd><Money value={b.total_cost} class="font-medium" /></dd>
						<dt class="text-muted-foreground">Booked</dt>
						<dd><time datetime={b.created_at}>{dateTime(b.created_at)}</time></dd>
						<dt class="text-muted-foreground">Reference</dt>
						<dd class="font-mono text-xs" title={b.id}>{b.id.slice(0, 8).toUpperCase()}</dd>
					</dl>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Status</Card.Title>
					<Card.Description>Each stay goes from confirmed to checked in to completed.</Card.Description>
				</Card.Header>
				<Card.Content>
					<StatusTimeline status={b.status} />
				</Card.Content>
				<!-- Check-in and check-out happen at the front desk, so only managers move a booking on. -->
				{#if actor.isManager && b.status !== 'COMPLETED'}
					<Card.Footer>
						<StatusAction
							booking={b}
							size="default"
							class="w-full"
							onconflict={(error, attempted) =>
								(conflict = {
									attempted,
									activeId: typeof error.detail.active_booking_id === 'string' ? error.detail.active_booking_id : null,
									message: error.message
								})}
						/>
					</Card.Footer>
				{/if}
			</Card.Root>
		</div>
	{/if}
{/if}
