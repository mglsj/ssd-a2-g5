<script lang="ts">
	import * as Card from '#lib/components/shadcn/card/index.js';
	import Money from '#lib/components/data/Money.svelte';
	import type { PropertyDetail } from '#lib/api/queries.js';

	// Phase 3 turns this into the Workflow 1 booking form.
	let { property }: { property: PropertyDetail } = $props();
</script>

<Card.Root elevated>
	<Card.Header>
		<Card.Title>Book this stay</Card.Title>
		<Card.Description>
			<Money value={property.base_price} class="text-foreground font-medium" /> per night
		</Card.Description>
	</Card.Header>
</Card.Root>
