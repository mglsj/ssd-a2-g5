<script lang="ts" module>
	import { hashId } from './photos.js';

	// Shown behind the photo while it loads, and instead of it if it fails.
	const tiles = [
		'bg-sticker-sky/20',
		'bg-sticker-purple/30',
		'bg-sticker-pink/15',
		'bg-sticker-orange/15',
		'bg-sticker-teal/20',
		'bg-sticker-green/15'
	];

	export function tileFor(id: string): string {
		return tiles[hashId(id) % tiles.length];
	}
</script>

<script lang="ts">
	import Building2Icon from '@lucide/svelte/icons/building-2';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import StarIcon from '@lucide/svelte/icons/star';
	import { createQuery } from '@tanstack/svelte-query';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import { queries } from '#lib/api/queries.js';
	import { count, distance, rupees } from '#lib/format.js';
	import { cn } from '#lib/utils.js';
	import { photoFor, photoSrcset, photoUrl } from './photos.js';

	type Props = {
		property: { id: string; title: string; base_price: string; distance_meters: number | null };
		/** Cards in the first row load their photo at once. The rest wait until scrolled near. */
		eager?: boolean;
	};

	let { property, eager = false }: Props = $props();

	const photo = $derived(photoFor(property.id));
	let failed = $state(false);

	// The same review summary the property page shows, so opening the card reuses it.
	const reviews = createQuery(() => ({ ...queries.reviews.facets(property.id), staleTime: 5 * 60_000 }));
	const summary = $derived(reviews.data?.overall_summary);
</script>

<a
	href="/properties/{property.id}"
	data-slot="property-card"
	class="group bg-card ring-border hover:shadow-soft focus-visible:ring-ring flex w-full flex-col overflow-hidden rounded-lg ring-1 transition-shadow outline-none focus-visible:ring-[3px]"
>
	<div class={cn('relative grid aspect-[5/2] place-items-center overflow-hidden', tileFor(property.id))}>
		<Building2Icon class="text-foreground/40 size-10" strokeWidth={1.25} aria-hidden="true" />
		{#if !failed}
			<!-- An illustrative stock photo, so the alt text stays empty rather than describing a room that is not this one. -->
			<img
				src={photoUrl(photo, 640, 256)}
				srcset={photoSrcset(photo, [400, 640, 960], 5 / 2)}
				sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
				alt=""
				loading={eager ? 'eager' : 'lazy'}
				decoding="async"
				width="640"
				height="256"
				onerror={() => (failed = true)}
				class="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
			/>
		{/if}
	</div>
	<div class="flex flex-1 flex-col gap-1.5 p-4">
		<h2 class="text-title line-clamp-2 group-hover:underline">{property.title}</h2>
		<div class="text-body-sm text-ink-secondary mt-auto flex flex-wrap items-center gap-x-2">
			<span><span class="text-foreground font-medium tabular-nums">{rupees(property.base_price, { whole: true })}</span> / night</span>
			{#if property.distance_meters !== null}
				<span aria-hidden="true">·</span>
				<span class="inline-flex items-center gap-1 tabular-nums">
					<MapPinIcon class="size-3.5" aria-hidden="true" />
					{distance(property.distance_meters)}<span class="sr-only"> from IIIT Hyderabad</span>
				</span>
			{/if}
			<span class="ms-auto inline-flex items-center gap-1">
				{#if reviews.isPending}
					<Skeleton class="h-4 w-14" />
				{:else if summary && summary.total_reviews > 0 && summary.overall_avg_rating !== null}
					<StarIcon class="fill-rating text-rating size-3.5" aria-hidden="true" />
					<span aria-hidden="true" class="text-foreground font-medium tabular-nums">{summary.overall_avg_rating.toFixed(1)}</span>
					<span aria-hidden="true" class="tabular-nums">({count(summary.total_reviews)})</span>
					<span class="sr-only">
						Rated {summary.overall_avg_rating.toFixed(1)} out of 5 from {count(summary.total_reviews)}
						{summary.total_reviews === 1 ? 'review' : 'reviews'}
					</span>
				{:else if reviews.isSuccess}
					<span class="text-muted-foreground">No reviews yet</span>
				{/if}
			</span>
		</div>
	</div>
</a>
