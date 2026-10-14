<script lang="ts">
	import type { PropertyDetail } from '#lib/api/queries.js';
	import { getActor } from '#lib/state/actor.svelte.js';
	import BookingForm from './BookingForm.svelte';

	let { property }: { property: PropertyDetail } = $props();

	const actor = getActor();
</script>

<!-- A new guest starts a fresh form, so one guest's result never shows under another's name. -->
{#key actor.guestId}
	<BookingForm {property} guestId={actor.guestId} isManager={actor.isManager} />
{/key}
