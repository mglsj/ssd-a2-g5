<script lang="ts" module>
	import type { BookingStatus } from '#lib/format.js';

	/** The one move sp_update_booking_status allows from each status. */
	export const nextStep: Partial<Record<BookingStatus, { to: BookingStatus; label: string; done: string }>> = {
		CONFIRMED: { to: 'CHECKED_IN', label: 'Check in', done: 'Checked in' },
		CHECKED_IN: { to: 'COMPLETED', label: 'Complete', done: 'Completed' }
	};
</script>

<script lang="ts">
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import DoorOpenIcon from '@lucide/svelte/icons/door-open';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { Button, type ButtonSize } from '#lib/components/shadcn/button/index.js';
	import { Spinner } from '#lib/components/shadcn/spinner/index.js';
	import { ApiError, toApiError, userMessage } from '#lib/api/errors.js';
	import { applyBooking, keys, mutations, type Booking } from '#lib/api/queries.js';
	import { isoDate, longDay, statusLabel } from '#lib/format.js';

	type Props = {
		booking: Booking;
		/** Called when the guest already has a CHECKED_IN booking (idx_active_stay). */
		onconflict?: (error: ApiError, booking: Booking) => void;
		size?: ButtonSize;
		class?: string;
	};

	let { booking, onconflict, size = 'sm', class: className }: Props = $props();

	const queryClient = useQueryClient();
	const step = $derived(nextStep[booking.status]);
	// Check-in opens on the booked day. The API enforces this too.
	const notYet = $derived(step?.to === 'CHECKED_IN' && booking.check_in_date > isoDate(new Date()));

	const change = createMutation(() => ({
		mutationFn: (to: BookingStatus) => mutations.setStatus(booking.id, to),
		onSuccess: (result) => {
			applyBooking(queryClient, result.booking);
			// The guest's active stay and counts changed. A completed stay is new revenue.
			queryClient.invalidateQueries({ queryKey: keys.guests.all });
			queryClient.invalidateQueries({ queryKey: ['analytics'] });
			toast.success(`${statusLabel[result.booking.status]}: ${result.booking.guest_name}`, {
				description: `${result.booking.property_title} moved from ${statusLabel[result.previous_status as BookingStatus] ?? result.previous_status} to ${statusLabel[result.booking.status]}.`
			});
		},
		onError: (raw) => {
			const error = toApiError(raw);
			if (error.code === 'ALREADY_CHECKED_IN' && onconflict) {
				onconflict(error, booking);
			} else if (error.code === 'TOO_EARLY_TO_CHECK_IN') {
				toast.error('Too early to check in', { description: userMessage(error) });
				queryClient.invalidateQueries({ queryKey: keys.bookings.all });
			} else if (error.code === 'INVALID_TRANSITION') {
				// The row was stale, for example changed in another tab. Show the move and refresh.
				const label = (status: unknown) => statusLabel[status as BookingStatus] ?? String(status);
				const from = label(error.detail.from ?? booking.status);
				const to = label(error.detail.to ?? step?.to);
				toast.error('That status change is not allowed', {
					description: `It cannot go from ${from} to ${to}. The page now shows its latest status.`
				});
				queryClient.invalidateQueries({ queryKey: keys.bookings.all });
			} else {
				toast.error(userMessage(error));
			}
		}
	}));
</script>

{#if step}
	<Button
		{size}
		variant={step.to === 'CHECKED_IN' ? 'default' : 'outline'}
		class={className}
		disabled={change.isPending || notYet}
		title={notYet ? `Check-in opens on ${longDay(booking.check_in_date)}` : undefined}
		onclick={() => change.mutate(step.to)}
		aria-label="{step.label} {booking.guest_name} at {booking.property_title}"
	>
		{#if change.isPending}
			<Spinner data-icon="inline-start" />
		{:else if step.to === 'CHECKED_IN'}
			<DoorOpenIcon data-icon="inline-start" />
		{:else}
			<CircleCheckIcon data-icon="inline-start" />
		{/if}
		{step.label}
	</Button>
{/if}
