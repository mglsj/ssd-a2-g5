<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CalendarXIcon from '@lucide/svelte/icons/calendar-x';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import { createQuery } from '@tanstack/svelte-query';
	import { page } from '$app/state';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import * as Card from '#lib/components/shadcn/card/index.js';
	import { Input } from '#lib/components/shadcn/input/index.js';
	import { Label } from '#lib/components/shadcn/label/index.js';
	import * as Select from '#lib/components/shadcn/select/index.js';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import DataTable, { type Column } from '#lib/components/data/DataTable.svelte';
	import FilterBar from '#lib/components/data/FilterBar.svelte';
	import Money from '#lib/components/data/Money.svelte';
	import Pager from '#lib/components/data/Pager.svelte';
	import EmptyState from '#lib/components/states/EmptyState.svelte';
	import ErrorState from '#lib/components/states/ErrorState.svelte';
	import QueryBoundary from '#lib/components/states/QueryBoundary.svelte';
	import ActionBadge from '#lib/features/wallet/ActionBadge.svelte';
	import TopUpDialog from '#lib/features/wallet/TopUpDialog.svelte';
	import { toApiError } from '#lib/api/errors.js';
	import { PAGE_SIZE, queries, type AuditPage, type AuditQuery } from '#lib/api/queries.js';
	import { count, date, dateTime, fromPaise, toPaise } from '#lib/format.js';
	import { enumParam, intParam, setParams, stringParam } from '#lib/url.js';

	type Row = AuditPage['items'][number];

	const id = $derived(page.params.id ?? '');
	const DATE = /^\d{4}-\d{2}-\d{2}$/;

	const from = $derived(DATE.test(stringParam('from')) ? stringParam('from') : '');
	const to = $derived(DATE.test(stringParam('to')) ? stringParam('to') : '');
	const order = $derived(enumParam('order', ['desc', 'asc'] as const, 'desc'));
	const pageNumber = $derived(intParam('page', 1));
	const rangeError = $derived(from && to && from > to ? 'The end date is before the start date' : undefined);

	const guest = createQuery(() => queries.guests.detail(id));
	const query = $derived.by(
		(): AuditQuery => ({
			order,
			page: String(pageNumber),
			limit: String(PAGE_SIZE),
			...(from && !rangeError ? { from } : {}),
			...(to && !rangeError ? { to } : {})
		})
	);
	const audit = createQuery(() => queries.guests.audit(id, query));

	const orders = [
		{ value: 'desc', label: 'Newest first' },
		{ value: 'asc', label: 'Oldest first' }
	] as const;

	const filtered = $derived(from !== '' || to !== '');
	let topUpOpen = $state(false);

	const columns: Column<Row>[] = [
		{ key: 'time', header: 'Time', cell: time },
		{ key: 'action', header: 'Action', cell: action },
		{ key: 'amount', header: 'Amount', cell: amount, align: 'right' },
		{ key: 'balance', header: 'Running balance', cell: balance, align: 'right' }
	];

	// Describes the range actually sent, so an inverted range reads as all time.
	const usedFrom = $derived(rangeError ? '' : from);
	const usedTo = $derived(rangeError ? '' : to);
	const rangeLabel = $derived(
		usedFrom && usedTo
			? `${date(usedFrom)} to ${date(usedTo)}`
			: usedFrom
				? `since ${date(usedFrom)}`
				: usedTo
					? `up to ${date(usedTo)}`
					: 'all time'
	);
</script>

{#snippet time(row: Row)}<time datetime={row.timestamp}>{dateTime(row.timestamp)}</time>{/snippet}
{#snippet action(row: Row)}<ActionBadge action={row.action_type} />{/snippet}
{#snippet amount(row: Row)}<Money value={row.signed_amount} signed />{/snippet}
{#snippet balance(row: Row)}<Money value={row.balance_after} />{/snippet}

<svelte:head>
	<title>{guest.data ? `${guest.data.name}'s wallet` : 'Wallet'} · StaySpot</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="text-body-sm -mb-4">
	<ol class="flex flex-wrap items-center gap-1.5">
		<li><a href="/guests/{id}">{guest.data?.name ?? 'Guest'}</a></li>
		<li aria-hidden="true" class="text-faint">/</li>
		<li aria-current="page" class="text-muted-foreground">Wallet</li>
	</ol>
</nav>

{#if guest.isError && toApiError(guest.error).code === 'NOT_FOUND'}
	<EmptyState icon={SearchXIcon} title="Guest not found" description="There is no guest with this id. A reseed replaces every guest.">
		<Button href="/guests">
			<ArrowLeftIcon data-icon="inline-start" />
			Back to guests
		</Button>
	</EmptyState>
{:else}
	<PageHeader title="Wallet and audit trail" eyebrow={guest.data?.name ?? 'Guest'} description="Every change to the wallet, as written by the audit trigger. The log is append-only." />

	<div class="grid items-stretch gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
		<Card.Root>
			<Card.Header>
				<Card.Description>Balance now</Card.Description>
				<Card.Title class="text-heading-2">
					{#if guest.data}
						<Money value={guest.data.wallet_balance} />
					{:else if guest.isPending}
						<Skeleton class="h-8 w-40" />
					{:else}
						<span class="text-muted-foreground text-body-md">Unavailable</span>
					{/if}
				</Card.Title>
			</Card.Header>
			<Card.Footer>
				<Button onclick={() => (topUpOpen = true)} disabled={!guest.data}>
					<PlusIcon data-icon="inline-start" />
					Top up
				</Button>
			</Card.Footer>
		</Card.Root>

		<Card.Root>
			<Card.Content class="flex flex-col gap-4">
				<FilterBar active={filtered} onclear={() => setParams({ from: null, to: null })} label="Filter the audit trail">
					<div class="flex flex-col gap-1.5">
						<Label for="audit-from">From</Label>
						<Input id="audit-from" type="date" class="w-40" value={from} max={to || undefined} onchange={(event) => setParams({ from: event.currentTarget.value })} />
					</div>
					<div class="flex flex-col gap-1.5">
						<Label for="audit-to">To</Label>
						<Input
							id="audit-to"
							type="date"
							class="w-40"
							value={to}
							min={from || undefined}
							aria-invalid={rangeError ? 'true' : undefined}
							aria-describedby={rangeError ? 'audit-range-error' : undefined}
							onchange={(event) => setParams({ to: event.currentTarget.value })}
						/>
					</div>
					<div class="flex flex-col gap-1.5">
						<Label for="audit-order">Order</Label>
						<Select.Root type="single" value={order} onValueChange={(value) => setParams({ order: value === 'desc' ? null : value })}>
							<Select.Trigger id="audit-order" class="w-36">{orders.find((o) => o.value === order)?.label}</Select.Trigger>
							<Select.Content>
								{#each orders as option (option.value)}
									<Select.Item value={option.value} label={option.label} />
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				</FilterBar>
				{#if rangeError}
					<p id="audit-range-error" class="text-caption text-destructive">{rangeError}</p>
				{/if}

				{#if audit.data}
					{@const net = fromPaise(toPaise(audit.data.closing_balance) - toPaise(audit.data.opening_balance))}
					<div class="flex flex-col gap-1" aria-live="polite">
						<p class="text-body-md flex flex-wrap items-baseline gap-x-2 gap-y-1">
							<span>Opening <Money value={audit.data.opening_balance} class="font-semibold" /></span>
							<span aria-hidden="true">+</span>
							<span>
								{count(audit.data.total)} {audit.data.total === 1 ? 'row' : 'rows'}
								(<Money value={net} signed />)
							</span>
							<span aria-hidden="true">=</span>
							<span>Closing <Money value={audit.data.closing_balance} class="font-semibold" /></span>
						</p>
						<p class="text-caption text-muted-foreground">
							Opening plus every row in the range equals closing. Range: {rangeLabel}, in UTC days.
						</p>
					</div>
				{:else if audit.isPending}
					<Skeleton class="h-6 w-2/3" />
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	{#if guest.isError}
		<ErrorState error={guest.error} onretry={() => guest.refetch()} retrying={guest.isFetching} />
	{/if}

	<QueryBoundary query={audit} isEmpty={(data) => data.items.length === 0}>
		{#snippet loading()}
			<div class="flex flex-col gap-2">
				{#each { length: 6 }, i (i)}<Skeleton class="h-12 w-full" />{/each}
			</div>
		{/snippet}
		{#snippet empty()}
			<EmptyState
				icon={CalendarXIcon}
				title={filtered ? 'No wallet activity between these dates' : pageNumber > 1 ? 'No rows on this page' : 'No wallet activity yet'}
				description={filtered ? 'Try a wider range, or clear the dates.' : 'Top-ups and bookings add rows here.'}
			>
				{#if filtered}
					<Button onclick={() => setParams({ from: null, to: null })}>Clear dates</Button>
				{:else if pageNumber > 1}
					<Button variant="outline" onclick={() => setParams({ page: null })}>Go to page 1</Button>
				{/if}
			</EmptyState>
		{/snippet}
		{#snippet children(data)}
			<DataTable items={data.items} {columns} getKey={(row) => row.id} caption="Wallet audit trail" />
			<Pager page={data.page} limit={data.limit} total={data.total} noun="rows" />
		{/snippet}
	</QueryBoundary>

	<TopUpDialog bind:open={topUpOpen} guestId={id} guestName={guest.data?.name} />
{/if}
