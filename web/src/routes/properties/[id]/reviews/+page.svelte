<script lang="ts">
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import XIcon from '@lucide/svelte/icons/x';
	import { createQuery } from '@tanstack/svelte-query';
	import { page } from '$app/state';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import * as Card from '#lib/components/shadcn/card/index.js';
	import { Label } from '#lib/components/shadcn/label/index.js';
	import * as Select from '#lib/components/shadcn/select/index.js';
	import { Separator } from '#lib/components/shadcn/separator/index.js';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import { humanize } from '#lib/components/catalog/CatalogValue.svelte';
	import Pager from '#lib/components/data/Pager.svelte';
	import RatingDistribution from '#lib/components/reviews/RatingDistribution.svelte';
	import ReviewCard from '#lib/components/reviews/ReviewCard.svelte';
	import EmptyState from '#lib/components/states/EmptyState.svelte';
	import QueryBoundary from '#lib/components/states/QueryBoundary.svelte';
	import OverallSummary from '#lib/features/reviews/OverallSummary.svelte';
	import TopTags from '#lib/features/reviews/TopTags.svelte';
	import { PAGE_SIZE, queries, type ReviewListQuery } from '#lib/api/queries.js';
	import { count } from '#lib/format.js';
	import { enumParam, intParam, setParams, stringParam } from '#lib/url.js';

	// One property's reviews, for a guest deciding whether to book it.
	const ratings = ['5', '4', '3', '2', '1'] as const;

	const id = $derived(page.params.id ?? '');
	const tag = $derived(stringParam('tag') || null);
	const rating = $derived(enumParam('rating', [...ratings, 'any'], 'any'));
	const pageNumber = $derived(intParam('page', 1));

	const property = createQuery(() => queries.properties.detail(id));
	const facets = createQuery(() => queries.reviews.facets(id));
	const list = createQuery(() =>
		queries.reviews.list({
			property_id: id,
			page: String(pageNumber),
			limit: String(PAGE_SIZE),
			...(tag ? { tag } : {}),
			...(rating !== 'any' ? { rating } : {})
		} satisfies ReviewListQuery)
	);

	const filtered = $derived(tag !== null || rating !== 'any');
	const title = $derived(property.data?.title ?? 'Property');

	/** A link to this page with some filters changed, back on page 1. */
	function hrefWith(params: Record<string, string | null>) {
		const url = new URL(page.url.href);
		url.searchParams.delete('page');
		for (const [key, value] of Object.entries(params)) {
			if (value === null) url.searchParams.delete(key);
			else url.searchParams.set(key, value);
		}
		return `${url.pathname}${url.search}`;
	}
</script>

<svelte:head>
	<title>Reviews of {title} · StaySpot</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="text-body-sm -mb-4">
	<ol class="flex flex-wrap items-center gap-1.5">
		<li><a href="/properties">Properties</a></li>
		<li aria-hidden="true" class="text-faint">/</li>
		<li><a href="/properties/{id}">{title}</a></li>
		<li aria-hidden="true" class="text-faint">/</li>
		<li aria-current="page" class="text-muted-foreground">Reviews</li>
	</ol>
</nav>

<PageHeader title="Reviews" eyebrow={title} description="What guests said after staying here." />

<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
	<Card.Root class="lg:order-2">
		<Card.Header>
			<Card.Title>Ratings</Card.Title>
			<Card.Description>Click a rating or a tag to filter the reviews.</Card.Description>
		</Card.Header>
		<Card.Content class="flex flex-col gap-6">
			<QueryBoundary query={facets} isEmpty={(data) => data.overall_summary.total_reviews === 0}>
				{#snippet loading()}
					<div class="flex flex-col gap-2">
						<Skeleton class="h-10 w-1/2" />
						{#each { length: 5 }, i (i)}<Skeleton class="h-3 w-full" />{/each}
					</div>
				{/snippet}
				{#snippet empty()}
					<p class="text-body-sm text-muted-foreground">No ratings yet.</p>
				{/snippet}
				{#snippet children(data)}
					<OverallSummary summary={data.overall_summary} />
					<RatingDistribution
						buckets={data.rating_distributions}
						active={rating === 'any' ? null : Number(rating)}
						href={(stars) => hrefWith({ rating: rating === String(stars) ? null : String(stars) })}
					/>
					{#if data.most_frequent_tags.length > 0}
						<section class="flex flex-col gap-2" aria-labelledby="tags-heading">
							<h3 id="tags-heading" class="text-eyebrow text-muted-foreground uppercase">What guests mention</h3>
							<TopTags tags={data.most_frequent_tags} active={tag} onselect={(next) => setParams({ tag: next })} />
						</section>
					{/if}
				{/snippet}
			</QueryBoundary>
		</Card.Content>
	</Card.Root>

	<Card.Root class="lg:order-1">
		<Card.Header>
			<div role="search" aria-label="Filter reviews" class="flex flex-wrap items-end gap-3">
				{#if tag}
					<div class="flex flex-col gap-1.5">
						<span class="text-sm font-medium select-none">Tag</span>
						<Button variant="secondary" onclick={() => setParams({ tag: null })} aria-label="Remove the {humanize(tag)} tag filter">
							{humanize(tag)}
							<XIcon data-icon="inline-end" />
						</Button>
					</div>
				{/if}
				<div class="flex flex-col gap-1.5">
					<Label for="review-rating">Rating</Label>
					<Select.Root type="single" value={rating} onValueChange={(value) => setParams({ rating: value === 'any' ? null : value })}>
						<Select.Trigger id="review-rating" class="w-36">{rating === 'any' ? 'Any rating' : `${rating} stars`}</Select.Trigger>
						<Select.Content>
							<Select.Item value="any" label="Any rating" />
							{#each ratings as option (option)}
								<Select.Item value={option} label="{option} stars" />
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				{#if filtered}
					<Button variant="ghost" onclick={() => setParams({ tag: null, rating: null })}>
						<XIcon data-icon="inline-start" />
						Clear filters
					</Button>
				{/if}
				<p class="text-body-sm text-muted-foreground ms-auto self-center tabular-nums" aria-live="polite">
					{#if list.data}
						{count(list.data.total)} {list.data.total === 1 ? 'review' : 'reviews'}
					{/if}
				</p>
			</div>
		</Card.Header>
		<Card.Content class="flex flex-col gap-5">
			<QueryBoundary query={list} isEmpty={(data) => data.items.length === 0}>
				{#snippet loading()}
					<div class="flex flex-col gap-4">
						{#each { length: 4 }, i (i)}<Skeleton class="h-24 w-full" />{/each}
					</div>
				{/snippet}
				{#snippet empty()}
					<EmptyState
						icon={MessageSquareIcon}
						title={filtered ? 'No reviews match' : pageNumber > 1 ? 'No reviews on this page' : 'No reviews yet'}
						description={filtered ? 'Try another tag or rating, or clear the filters.' : 'Guests have not reviewed this stay yet.'}
						class="p-6"
					>
						{#if pageNumber > 1}
							<Button variant="outline" onclick={() => setParams({ page: null })}>Go to page 1</Button>
						{/if}
						{#if filtered}
							<Button onclick={() => setParams({ tag: null, rating: null })}>Clear filters</Button>
						{/if}
					</EmptyState>
				{/snippet}
				{#snippet children(data)}
					<ul class="flex flex-col">
						{#each data.items as review, i (review.id)}
							<li class="flex flex-col">
								{#if i > 0}<Separator class="my-4" />{/if}
								<ReviewCard {review} activeTag={tag} tagHref={(next) => hrefWith({ tag: next === tag ? null : next })} />
							</li>
						{/each}
					</ul>
					<Pager page={data.page} limit={data.limit} total={data.total} noun="reviews" />
				{/snippet}
			</QueryBoundary>
		</Card.Content>
	</Card.Root>
</div>
