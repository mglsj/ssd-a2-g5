<script lang="ts" module>
	// Decorative sticker tiles stand in for photos. The colour follows the id, so a card keeps its colour.
	const tiles = [
		'bg-sticker-sky/20',
		'bg-sticker-purple/30',
		'bg-sticker-pink/15',
		'bg-sticker-orange/15',
		'bg-sticker-teal/20',
		'bg-sticker-green/15'
	];

	export function tileFor(id: string): string {
		let hash = 0;
		for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
		return tiles[hash % tiles.length];
	}
</script>

<script lang="ts">
	import Building2Icon from '@lucide/svelte/icons/building-2';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import { distance, rupees } from '#lib/format.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		property: { id: string; title: string; base_price: string; distance_meters: number | null };
	};

	let { property }: Props = $props();
</script>

<a
	href="/properties/{property.id}"
	data-slot="property-card"
	class="group bg-card ring-border hover:shadow-soft w-full focus-visible:ring-ring flex flex-col overflow-hidden rounded-lg ring-1 transition-shadow outline-none focus-visible:ring-[3px]"
>
	<div class={cn('grid aspect-[5/2] place-items-center', tileFor(property.id))} aria-hidden="true">
		<Building2Icon class="text-foreground/40 size-10" strokeWidth={1.25} />
	</div>
	<div class="flex flex-1 flex-col gap-1.5 p-4">
		<h2 class="text-title line-clamp-2 group-hover:underline">{property.title}</h2>
		<p class="text-body-sm text-ink-secondary flex flex-wrap items-center gap-x-2">
			<span><span class="text-foreground font-medium tabular-nums">{rupees(property.base_price, { whole: true })}</span> / night</span>
			{#if property.distance_meters !== null}
				<span aria-hidden="true">·</span>
				<span class="inline-flex items-center gap-1 tabular-nums">
					<MapPinIcon class="size-3.5" aria-hidden="true" />
					{distance(property.distance_meters)}<span class="sr-only"> from IIIT Hyderabad</span>
				</span>
			{/if}
		</p>
	</div>
</a>
