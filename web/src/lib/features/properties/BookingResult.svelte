<script lang="ts">
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import WalletIcon from '@lucide/svelte/icons/wallet';
	import { Badge } from '#lib/components/shadcn/badge/index.js';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import * as Card from '#lib/components/shadcn/card/index.js';
	import Money from '#lib/components/data/Money.svelte';
	import StatusBadge from '#lib/components/data/StatusBadge.svelte';
	import AuditRow from '#lib/features/wallet/AuditRow.svelte';
	import { longDay } from '#lib/format.js';
	import type { BookingResult } from '#lib/api/queries.js';

	let { result, onreset }: { result: BookingResult; onreset: () => void } = $props();

	const booking = $derived(result.booking);
</script>

<Card.Root elevated aria-live="polite">
	<Card.Header>
		<Badge variant="success" class="mb-1">
			<CircleCheckIcon data-icon="inline-start" aria-hidden="true" />
			Booking confirmed
		</Badge>
		<Card.Title>{booking.nights} {booking.nights === 1 ? 'night' : 'nights'} for {booking.guest_name}</Card.Title>
		<Card.Description class="flex flex-wrap items-center gap-x-2 gap-y-1">
			<Money value={booking.total_cost} class="text-foreground font-medium" />
			<span aria-hidden="true">·</span>
			<span>From {longDay(booking.check_in_date)}</span>
			<span aria-hidden="true">·</span>
			<StatusBadge status={booking.status} />
			<span aria-hidden="true">·</span>
			<span>Ref. <span class="font-mono text-xs">{booking.id.slice(0, 8).toUpperCase()}</span></span>
		</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-5">
		<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
			<div class="bg-muted flex flex-col gap-1 rounded-md p-3">
				<span class="text-eyebrow text-muted-foreground uppercase">Wallet before</span>
				<Money value={result.balance_before} class="text-body-md font-semibold" />
			</div>
			<ArrowRightIcon class="text-muted-foreground size-4" aria-label="to" />
			<div class="bg-muted flex flex-col gap-1 rounded-md p-3">
				<span class="text-eyebrow text-muted-foreground uppercase">Wallet after</span>
				<Money value={result.balance_after} class="text-body-md font-semibold" />
			</div>
		</div>
		<AuditRow entry={result.audit_log} />
	</Card.Content>
	<Card.Footer class="flex flex-wrap gap-2">
		<Button href="/bookings/{booking.id}">View booking</Button>
		<Button href="/guests/{booking.guest_id}/wallet" variant="outline">
			<WalletIcon data-icon="inline-start" />
			Open wallet
		</Button>
		<Button variant="ghost" onclick={onreset}>Book again</Button>
	</Card.Footer>
</Card.Root>
