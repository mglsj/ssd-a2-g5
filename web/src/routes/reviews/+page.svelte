<script lang="ts">
	import FileTextIcon from '@lucide/svelte/icons/file-text';
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
	import CatalogDocument from '#lib/components/catalog/CatalogDocument.svelte';
	import { humanize } from '#lib/components/catalog/CatalogValue.svelte';
	import EntityPicker from '#lib/components/data/EntityPicker.svelte';
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
	import AccessGate from '#lib/components/app/AccessGate.svelte';
	import { getActor } from '#lib/state/actor.svelte.js';

	const actor = getActor();

	const ratings = ['5', '4', '3', '2', '1'] as const;

	const propertyId = $derived(stringParam('property_id') || null);
	const tag = $derived(stringParam('tag') || null);
	const rating = $derived(enumParam('rating', [...ratings, 'any'], 'any'));
	const pageNumber = $derived(intParam('page', 1));

	const query = $derived.by(
		(): ReviewListQuery => ({
			page: String(pageNumber),
			limit: String(PAGE_SIZE),
			...(propertyId ? { property_id: propertyId } : {}),
			...(tag ? { tag } : {}),
			...(rating !== 'any' ? { rating } : {})
		})
	);

	const facets = createQuery(() => queries.reviews.facets(propertyId));
	const list = createQuery(() => queries.reviews.list(query));
	const amenities = createQuery(() => ({ ...queries.properties.amenities(propertyId ?? ''), enabled: propertyId !== null }));

	const filtered = $derived(tag !== null || rating !== 'any');

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
	<title>Review insights · StaySpot</title>
</svelte:head>

{#if !actor.isManager}
	<AccessGate kind="manager" what="review insights" />
{:else}
	<PageHeader title="Review insights" description="How guests rate stays across Hyderabad, and what they mention.">
		{#snippet actions()}
			<EntityPicker
				kind="property"
				id="review-scope"
				label="Scope"
				placeholder="All properties"
				value={propertyId}
				onchange={(id) => setParams({ property_id: id })}
				class="w-full sm:w-72"
			/>
		{/snippet}
	</PageHeader>

	<QueryBoundary query={facets} isEmpty={(data) => data.overall_summary.total_reviews === 0}>
		{#snippet loading()}
			<div class="grid gap-6 lg:grid-cols-3">
				{#each { length: 3 }, i (i)}<Skeleton class="h-64 w-full rounded-lg" />{/each}
			</div>
		{/snippet}
		{#snippet empty()}
			<EmptyState
				icon={MessageSquareIcon}
				title="No reviews yet"
				description={propertyId ? 'Guests have not reviewed this property.' : 'No one has written a review yet.'}
			>
				{#if propertyId}
					<Button variant="outline" onclick={() => setParams({ property_id: null })}>Show all properties</Button>
				{/if}
			</EmptyState>
		{/snippet}
		{#snippet children(data)}
			<div class="grid gap-6 lg:grid-cols-3">
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-eyebrow text-muted-foreground uppercase">Overall</Card.Title>
					</Card.Header>
					<Card.Content>
						<OverallSummary summary={data.overall_summary} />
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title class="text-eyebrow text-muted-foreground uppercase">Rating distribution</Card.Title>
						<Card.Description>Click a rating to filter the reviews.</Card.Description>
					</Card.Header>
					<Card.Content>
						<RatingDistribution
							buckets={data.rating_distributions}
							active={rating === 'any' ? null : Number(rating)}
							href={(stars) => hrefWith({ rating: rating === String(stars) ? null : String(stars) })}
						/>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title class="text-eyebrow text-muted-foreground uppercase">Top tags</Card.Title>
						<Card.Description>What guests mention most. Click one to filter.</Card.Description>
					</Card.Header>
					<Card.Content>
						{#if data.most_frequent_tags.length > 0}
							<TopTags tags={data.most_frequent_tags} active={tag} onselect={(next) => setParams({ tag: next })} />
						{:else}
							<p class="text-body-sm text-muted-foreground">No location tags on these reviews.</p>
						{/if}
					</Card.Content>
				</Card.Root>
			</div>
		{/snippet}
	</QueryBoundary>

	<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
		<Card.Root>
			<Card.Header class="flex flex-col gap-4">
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
							title={pageNumber > 1 ? 'No reviews on this page' : 'No reviews match'}
							description={filtered ? 'Try another tag or rating, or clear the filters.' : 'There are no reviews here yet.'}
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
									<ReviewCard
										{review}
										showProperty={propertyId === null}
										activeTag={tag}
										tagHref={(next) => hrefWith({ tag: next === tag ? null : next })}
									/>
								</li>
							{/each}
						</ul>
						<Pager page={data.page} limit={data.limit} total={data.total} noun="reviews" />
					{/snippet}
				</QueryBoundary>
			</Card.Content>
		</Card.Root>

		{#if propertyId}
			<CatalogDocument query={amenities} />
		{:else}
			<Card.Root>
				<Card.Header>
					<Card.Title>Amenities and rules</Card.Title>
					<Card.Description>What a stay offers, and its house rules</Card.Description>
				</Card.Header>
				<Card.Content class="flex flex-col gap-4">
					<EmptyState
						icon={FileTextIcon}
						title="Pick a property"
						description="Choose a property to see its amenities and house rules, and only its reviews."
						class="p-6"
					/>
					<EntityPicker
						kind="property"
						id="catalog-property"
						label="Property"
						placeholder="Choose a property"
						value={propertyId}
						onchange={(id) => setParams({ property_id: id })}
					/>
				</Card.Content>
			</Card.Root>
		{/if}
	</div>
{/if}
