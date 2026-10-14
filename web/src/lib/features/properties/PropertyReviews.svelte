<script lang="ts">
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import { createQuery } from '@tanstack/svelte-query';
	import { Badge } from '#lib/components/shadcn/badge/index.js';
	import * as Card from '#lib/components/shadcn/card/index.js';
	import { Separator } from '#lib/components/shadcn/separator/index.js';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import { humanize } from '#lib/components/catalog/CatalogValue.svelte';
	import RatingDistribution from '#lib/components/reviews/RatingDistribution.svelte';
	import ReviewCard from '#lib/components/reviews/ReviewCard.svelte';
	import Stars from '#lib/components/reviews/Stars.svelte';
	import EmptyState from '#lib/components/states/EmptyState.svelte';
	import QueryBoundary from '#lib/components/states/QueryBoundary.svelte';
	import { queries } from '#lib/api/queries.js';
	import { count } from '#lib/format.js';

	let { propertyId, class: className }: { propertyId: string; class?: string } = $props();

	const facets = createQuery(() => queries.reviews.facets(propertyId));
	const latest = createQuery(() => queries.reviews.list({ property_id: propertyId, limit: '3' }));

	const reviewsHref = (params: Record<string, string> = {}) =>
		`/reviews?${new URLSearchParams({ property_id: propertyId, ...params })}`;
</script>

<Card.Root class={className}>
	<Card.Header>
		<Card.Title>Reviews</Card.Title>
		<Card.Description>From the $facet pipeline on PropertyReviews</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-5">
		<QueryBoundary query={facets} isEmpty={(data) => data.overall_summary.total_reviews === 0}>
			{#snippet loading()}
				<div class="flex flex-col gap-2">
					<Skeleton class="h-6 w-1/2" />
					{#each { length: 5 }, i (i)}<Skeleton class="h-3 w-full" />{/each}
				</div>
			{/snippet}
			{#snippet empty()}
				<EmptyState icon={MessageSquareIcon} title="No reviews yet" description="Guests have not reviewed this stay." class="p-6" />
			{/snippet}
			{#snippet children(data)}
				<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<Stars rating={data.overall_summary.overall_avg_rating ?? 0} class="text-title" />
					<span class="text-body-sm text-muted-foreground">
						average of {count(data.overall_summary.total_reviews)}
						{data.overall_summary.total_reviews === 1 ? 'review' : 'reviews'}
					</span>
				</div>
				<RatingDistribution buckets={data.rating_distributions} href={(rating) => reviewsHref({ rating: String(rating) })} />
				{#if data.most_frequent_tags.length > 0}
					<div class="flex flex-col gap-2">
						<h3 class="text-eyebrow text-muted-foreground uppercase">Top tags</h3>
						<ul class="flex flex-wrap gap-1.5">
							{#each data.most_frequent_tags.slice(0, 4) as tag (tag.tag)}
								<li>
									<Badge variant="outline" href={reviewsHref({ tag: tag.tag })} class="font-normal">
										{humanize(tag.tag)} <span class="text-muted-foreground tabular-nums">{tag.frequency}</span>
									</Badge>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			{/snippet}
		</QueryBoundary>

		{#if latest.data && latest.data.items.length > 0}
			<Separator />
			<div class="flex flex-col gap-4">
				<h3 class="text-eyebrow text-muted-foreground uppercase">Latest</h3>
				{#each latest.data.items as review (review.id)}
					<ReviewCard {review} tagHref={(tag) => reviewsHref({ tag })} />
				{/each}
			</div>
			<a href={reviewsHref()} class="text-body-sm w-fit">Read all {count(latest.data.total)} reviews</a>
		{/if}
	</Card.Content>
</Card.Root>
