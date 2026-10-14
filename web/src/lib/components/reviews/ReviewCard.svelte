<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { Badge } from '#lib/components/shadcn/badge/index.js';
	import { queries, type Review } from '#lib/api/queries.js';
	import { date } from '#lib/format.js';
	import { humanize } from '../catalog/CatalogValue.svelte';
	import Stars from './Stars.svelte';

	type Props = {
		review: Review;
		/** Links tags, for example to filter the review list. */
		tagHref?: (tag: string) => string;
		/** Show the property link, when the list mixes properties. */
		showProperty?: boolean;
		/** The tag the list is filtered by, drawn filled. */
		activeTag?: string | null;
	};

	let { review, tagHref, showProperty = false, activeTag = null }: Props = $props();

	// Reviews carry only the property id. The detail query is cached, so repeat properties cost nothing.
	const property = createQuery(() => ({ ...queries.properties.detail(review.property_id), enabled: showProperty }));
</script>

<article class="flex flex-col gap-2">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
			<Stars rating={review.rating} class="text-body-sm font-medium" />
			{#if showProperty}
				<span class="text-muted-foreground" aria-hidden="true">·</span>
				<a href="/properties/{review.property_id}" class="text-body-sm min-w-0 truncate">
					{property.data?.title ?? (property.isError ? 'View property' : 'Loading property…')}
				</a>
			{/if}
		</div>
		<time class="text-caption text-muted-foreground" datetime={review.created_at}>{date(review.created_at)}</time>
	</div>
	{#if review.review_text}
		<p class="text-body-sm text-ink-secondary">{review.review_text}</p>
	{/if}
	{#if Object.keys(review.sub_ratings ?? {}).length > 0}
		<dl class="text-caption text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
			{#each Object.entries(review.sub_ratings ?? {}) as [key, value] (key)}
				<div class="flex gap-1">
					<dt>{humanize(key)}</dt>
					<dd class="text-foreground tabular-nums">{value}</dd>
				</div>
			{/each}
		</dl>
	{/if}
	{#if review.location_tags.length > 0}
		<ul class="flex flex-wrap gap-1.5" aria-label="Location tags">
			{#each review.location_tags as tag (tag)}
				<li>
					<Badge variant={tag === activeTag ? 'secondary' : 'outline'} href={tagHref?.(tag)} class="font-normal">
						{humanize(tag)}
					</Badge>
				</li>
			{/each}
		</ul>
	{/if}
</article>
