<script lang="ts">
	import CloudOffIcon from '@lucide/svelte/icons/cloud-off';
	import { createQuery } from '@tanstack/svelte-query';
	import * as Alert from '#lib/components/shadcn/alert/index.js';
	import { queries } from '#lib/api/queries.js';

	const health = createQuery(() => queries.health());

	const problem = $derived.by(() => {
		const data = health.data;
		if (!data) return null;
		if (data.api === 'down' || (data.postgres === 'down' && data.mongo === 'down')) {
			return { title: 'StaySpot is unavailable', text: 'Nothing can load right now.' };
		}
		if (data.postgres === 'down') {
			return {
				title: 'Some of StaySpot is unavailable',
				text: 'Properties, bookings, wallets and analytics cannot load right now.'
			};
		}
		if (data.mongo === 'down') {
			return { title: 'Some of StaySpot is unavailable', text: 'The map, reviews and amenities cannot load right now.' };
		}
		return null;
	});
</script>

{#if problem}
	<div class="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
		<Alert.Root variant="destructive">
			<CloudOffIcon />
			<Alert.Title>{problem.title}</Alert.Title>
			<Alert.Description>{problem.text} We keep trying, and this message goes away once everything is back.</Alert.Description>
		</Alert.Root>
	</div>
{/if}
