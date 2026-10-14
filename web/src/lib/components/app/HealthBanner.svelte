<script lang="ts">
	import DatabaseIcon from '@lucide/svelte/icons/database';
	import { createQuery } from '@tanstack/svelte-query';
	import * as Alert from '#lib/components/shadcn/alert/index.js';
	import { queries } from '#lib/api/queries.js';

	const health = createQuery(() => queries.health());

	const problem = $derived.by(() => {
		const data = health.data;
		if (!data) return null;
		if (data.api === 'down') {
			return {
				title: 'The API is down',
				text: 'Nothing will load. Start it in the dev container with cd api && bun run dev.'
			};
		}
		if (data.postgres === 'down' && data.mongo === 'down') {
			return { title: 'Both databases are down', text: 'PostgreSQL and MongoDB are not answering. Nothing will load.' };
		}
		if (data.postgres === 'down') {
			return {
				title: 'A database is down',
				text: 'PostgreSQL is not answering. Guests, properties, bookings and analytics will not load.'
			};
		}
		if (data.mongo === 'down') {
			return { title: 'A database is down', text: 'MongoDB is not answering. The map and reviews will not load.' };
		}
		return null;
	});
</script>

{#if problem}
	<div class="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
		<Alert.Root variant="destructive">
			<DatabaseIcon />
			<Alert.Title>{problem.title}</Alert.Title>
			<Alert.Description>{problem.text} This banner clears on its own once it is back.</Alert.Description>
		</Alert.Root>
	</div>
{/if}
