<script lang="ts">
	import DataTable, { type Column } from '#lib/components/data/DataTable.svelte';
	import Money from '#lib/components/data/Money.svelte';
	import StatusBadge from '#lib/components/data/StatusBadge.svelte';
	import type { Booking } from '#lib/api/queries.js';
	import { date } from '#lib/format.js';
	import type { Snippet } from 'svelte';

	type Props = {
		items: Booking[];
		/** Hide the guest column, for example on a guest's own page. */
		showGuest?: boolean;
		actions?: Snippet<[Booking]>;
		caption?: string;
	};

	let { items, showGuest = true, actions, caption = 'Bookings' }: Props = $props();

	const columns = $derived(
		[
			{ key: 'property', header: 'Property', cell: property, class: 'whitespace-normal min-w-48' },
			showGuest ? { key: 'guest', header: 'Guest', cell: guest } : null,
			{ key: 'nights', header: 'Nights', cell: nights, align: 'right' },
			{ key: 'total', header: 'Total', cell: total, align: 'right' },
			{ key: 'status', header: 'Status', cell: status },
			{ key: 'created', header: 'Booked', cell: created }
		].filter((column) => column !== null) as Column<Booking>[]
	);
</script>

{#snippet property(b: Booking)}{b.property_title}{/snippet}
{#snippet guest(b: Booking)}<a href="/guests/{b.guest_id}" class="relative z-10">{b.guest_name}</a>{/snippet}
{#snippet nights(b: Booking)}{b.nights}{/snippet}
{#snippet total(b: Booking)}<Money value={b.total_cost} />{/snippet}
{#snippet status(b: Booking)}<StatusBadge status={b.status} />{/snippet}
{#snippet created(b: Booking)}<time datetime={b.created_at} class="text-muted-foreground">{date(b.created_at)}</time>{/snippet}

<DataTable
	{items}
	{columns}
	{actions}
	{caption}
	getKey={(b) => b.id}
	rowHref={(b) => `/bookings/${b.id}`}
	rowLabel={(b) => `Booking at ${b.property_title} for ${b.guest_name}, ${b.status.toLowerCase().replace('_', ' ')}`}
/>
