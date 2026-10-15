<script lang="ts">
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import ChartLineIcon from '@lucide/svelte/icons/chart-line';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import * as Card from '#lib/components/shadcn/card/index.js';
	import Money from '#lib/components/data/Money.svelte';
	import type { PropertyDetail } from '#lib/api/queries.js';
	import { count } from '#lib/format.js';

	// What a manager sees in place of the booking panel.
	let { property }: { property: PropertyDetail } = $props();

	const summary = $derived(property.summary);
</script>

<Card.Root elevated>
	<Card.Header>
		<Card.Title>Performance</Card.Title>
		<Card.Description>Completed stays, as of the last figures update</Card.Description>
	</Card.Header>
	<Card.Content>
		<dl class="grid grid-cols-2 gap-4">
			<div class="flex flex-col gap-1">
				<dt class="text-caption text-muted-foreground">Stays</dt>
				<dd class="text-title tabular-nums">{count(summary.completed_bookings)}</dd>
			</div>
			<div class="flex flex-col gap-1">
				<dt class="text-caption text-muted-foreground">Nights</dt>
				<dd class="text-title tabular-nums">{count(summary.total_nights_booked)}</dd>
			</div>
			<div class="col-span-2 flex flex-col gap-1">
				<dt class="text-caption text-muted-foreground">Revenue</dt>
				<dd class="text-heading-3 tabular-nums"><Money value={summary.gross_revenue} /></dd>
			</div>
		</dl>
	</Card.Content>
	<Card.Footer class="flex flex-wrap gap-2">
		<Button href="/bookings?property_id={property.id}" variant="outline">
			<CalendarDaysIcon data-icon="inline-start" />
			Bookings
		</Button>
		<Button href="/analytics?property={property.id}" variant="outline">
			<ChartLineIcon data-icon="inline-start" />
			Revenue trend
		</Button>
	</Card.Footer>
</Card.Root>
