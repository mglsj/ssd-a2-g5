<script lang="ts">
	import StarIcon from '@lucide/svelte/icons/star';
	import { Badge } from '#lib/components/shadcn/badge/index.js';
	import * as Card from '#lib/components/shadcn/card/index.js';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import { toApiError } from '#lib/api/errors.js';
	import type { Amenities } from '#lib/api/queries.js';
	import ErrorState from '#lib/components/states/ErrorState.svelte';
	import EmptyState from '#lib/components/states/EmptyState.svelte';
	import { relative } from '#lib/format.js';
	import type { CreateQueryResult } from '@tanstack/svelte-query';
	import CatalogValue, { humanize } from './CatalogValue.svelte';

	type Props = {
		query: CreateQueryResult<Amenities>;
		title?: string;
		class?: string;
	};

	let { query, title = 'Amenities and rules', class: className }: Props = $props();

	// Identity and metadata fields are shown in the header, not as sections.
	const meta = new Set(['property_id', 'property_title', 'star_rating', 'guest_rating', 'updated_at', '_id']);

	const sections = $derived(
		query.data ? Object.entries(query.data as Record<string, unknown>).filter(([key]) => !meta.has(key)) : []
	);
	const doc = $derived(query.data as Record<string, unknown> | undefined);
</script>

<Card.Root class={className}>
	<Card.Header>
		<Card.Title>{title}</Card.Title>
		<Card.Description>What this stay offers, and its house rules</Card.Description>
		{#if doc && (typeof doc.star_rating === 'number' || typeof doc.guest_rating === 'number')}
			<div class="flex flex-wrap gap-2 pt-1">
				{#if typeof doc.star_rating === 'number'}
					<Badge variant="outline">
						<StarIcon data-icon="inline-start" aria-hidden="true" />
						{doc.star_rating}-star
					</Badge>
				{/if}
				{#if typeof doc.guest_rating === 'number'}
					<Badge variant="outline">Guest rating {doc.guest_rating} / 10</Badge>
				{/if}
			</div>
		{/if}
	</Card.Header>
	<Card.Content class="flex flex-col gap-5">
		{#if query.isPending}
			<div class="flex flex-col gap-3" role="status">
				<span class="sr-only">Loading amenities…</span>
				<Skeleton class="h-6 w-3/4" />
				<Skeleton class="h-4 w-full" />
				<Skeleton class="h-4 w-2/3" />
			</div>
		{:else if query.isError}
			{#if toApiError(query.error).code === 'NOT_FOUND'}
				<EmptyState
					title="No details yet"
					description="This property has not listed its amenities or house rules yet."
					class="p-6"
				/>
			{:else}
				<ErrorState error={query.error} onretry={() => query.refetch()} retrying={query.isFetching} />
			{/if}
		{:else}
			{#each sections as [key, value] (key)}
				<section class="flex flex-col gap-2">
					<h3 class="text-eyebrow text-muted-foreground uppercase">{humanize(key)}</h3>
					<div class="text-body-sm"><CatalogValue {value} /></div>
				</section>
			{:else}
				<p class="text-body-sm text-muted-foreground">No amenities listed.</p>
			{/each}
			{#if typeof doc?.updated_at === 'string'}
				<p class="text-caption text-muted-foreground">Updated {relative(doc.updated_at)}</p>
			{/if}
		{/if}
	</Card.Content>
</Card.Root>
