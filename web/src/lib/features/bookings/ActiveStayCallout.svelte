<script lang="ts" module>
	export type Conflict = {
		/** The booking the user tried to check in. */
		attempted: { id: string; guest_name: string; property_title: string };
		/** The CHECKED_IN booking that blocks it, from detail.active_booking_id. */
		activeId: string | null;
		message: string;
	};
</script>

<script lang="ts">
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import BedDoubleIcon from '@lucide/svelte/icons/bed-double';
	import XIcon from '@lucide/svelte/icons/x';
	import { createQuery } from '@tanstack/svelte-query';
	import * as Alert from '#lib/components/shadcn/alert/index.js';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import { queries } from '#lib/api/queries.js';

	let { conflict, ondismiss }: { conflict: Conflict; ondismiss?: () => void } = $props();

	// Names the blocking stay. The callout still works from the id if this fails.
	const active = createQuery(() => ({
		...queries.bookings.detail(conflict.activeId ?? ''),
		enabled: conflict.activeId !== null
	}));

	const firstName = $derived(conflict.attempted.guest_name.split(' ')[0]);

	// Bring the callout into view: the button that caused it may be far down the list.
	function reveal(node: HTMLElement) {
		node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}
</script>

<div {@attach reveal}>
	<Alert.Root variant="destructive" aria-live="assertive">
		<BedDoubleIcon />
		<Alert.Title>{conflict.attempted.guest_name} is already checked in</Alert.Title>
		<Alert.Description>
			<p>
				{#if conflict.activeId}
					Booking <span class="font-mono text-xs">{conflict.activeId.slice(0, 8)}</span>
					{#if active.data}at {active.data.property_title}{/if} is still CHECKED_IN.
				{:else}
					{conflict.message}.
				{/if}
				Complete that stay before checking {firstName} in at {conflict.attempted.property_title}.
			</p>
			<p class="text-caption">
				The partial unique index idx_active_stay allows one CHECKED_IN booking per guest, so the database refused the
				second check-in.
			</p>
			<div class="mt-2 flex flex-wrap gap-2">
				{#if conflict.activeId}
					<Button size="sm" href="/bookings/{conflict.activeId}">
						Open that stay
						<ArrowRightIcon data-icon="inline-end" />
					</Button>
				{/if}
				{#if ondismiss}
					<Button size="sm" variant="ghost" onclick={ondismiss}>
						<XIcon data-icon="inline-start" />
						Dismiss
					</Button>
				{/if}
			</div>
		</Alert.Description>
	</Alert.Root>
</div>
