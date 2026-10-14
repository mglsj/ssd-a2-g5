<script lang="ts">
	import CalendarCheckIcon from '@lucide/svelte/icons/calendar-check';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import DoorOpenIcon from '@lucide/svelte/icons/door-open';
	import { Badge, type BadgeVariant } from '#lib/components/shadcn/badge/index.js';
	import { statusLabel, type BookingStatus } from '#lib/format.js';

	let { status, class: className }: { status: BookingStatus; class?: string } = $props();

	const styles = {
		CONFIRMED: { variant: 'default', icon: CalendarCheckIcon },
		CHECKED_IN: { variant: 'outline', icon: DoorOpenIcon },
		COMPLETED: { variant: 'success', icon: CircleCheckIcon }
	} satisfies Record<BookingStatus, { variant: BadgeVariant; icon: unknown }>;

	const style = $derived(styles[status]);
</script>

<Badge variant={style.variant} class={className}>
	<style.icon data-icon="inline-start" aria-hidden="true" />
	{statusLabel[status]}
</Badge>
