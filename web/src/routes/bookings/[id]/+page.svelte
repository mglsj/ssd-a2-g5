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
	import StatusTimeline from '#lib/features/bookings/StatusTimeline.svelte';
	import { toApiError } from '#lib/api/errors.js';
	import { queries } from '#lib/api/queries.js';
	import { dateTime } from '#lib/format.js';

	const id = $derived(page.params.id ?? '');
	const booking = createQuery(() => queries.bookings.detail(id));
</script>

<svelte:head>
	<title>{booking.data ? `Booking at ${booking.data.property_title}` : 'Booking'} · StaySpot</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="text-body-sm -mb-4">
	<ol class="flex flex-wrap items-center gap-1.5">
		<li><a href="/bookings">Bookings</a></li>
		<li aria-hidden="true" class="text-faint">/</li>
		<li aria-current="page" class="text-muted-foreground font-mono text-xs">{id.slice(0, 8)}</li>
	</ol>
</nav>

{#if booking.isPending}
	<div class="flex flex-col gap-4" role="status">
		<span class="sr-only">Loading the booking</span>
		<Skeleton class="h-10 w-1/2" />
		<Skeleton class="h-48" />
	</div>
{:else if booking.isError}
	{#if toApiError(booking.error).code === 'NOT_FOUND'}
		<EmptyState icon={SearchXIcon} title="Booking not found" description="There is no booking with this id.">
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

	<div class="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
		<Card.Root>
			<Card.Header>
				<Card.Title>Details</Card.Title>
			</Card.Header>
			<Card.Content>
				<dl class="text-body-sm grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
					<dt class="text-muted-foreground">Guest</dt>
					<dd><a href="/guests/{b.guest_id}">{b.guest_name}</a></dd>
					<dt class="text-muted-foreground">Property</dt>
					<dd><a href="/properties/{b.property_id}">{b.property_title}</a></dd>
					<dt class="text-muted-foreground">Nights</dt>
					<dd class="tabular-nums">{b.nights}</dd>
					<dt class="text-muted-foreground">Total paid</dt>
					<dd><Money value={b.total_cost} class="font-medium" /></dd>
					<dt class="text-muted-foreground">Booked</dt>
					<dd><time datetime={b.created_at}>{dateTime(b.created_at)}</time></dd>
					<dt class="text-muted-foreground">Booking id</dt>
					<dd class="font-mono text-xs break-all">{b.id}</dd>
				</dl>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Status</Card.Title>
				<Card.Description>Bookings move only forward, one step at a time.</Card.Description>
			</Card.Header>
			<Card.Content>
				<StatusTimeline status={b.status} />
			</Card.Content>
		</Card.Root>
	</div>
{/if}
