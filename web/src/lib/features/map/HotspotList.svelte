<script lang="ts">
	import type { Hotspot } from '#lib/api/queries.js';
	import { count, distance, relative } from '#lib/format.js';
	import { cn } from '#lib/utils.js';
	import { hotspotStatus } from './hotspot-status.js';

	type Props = {
		hotspots: Hotspot[];
		hovered: number | null;
		onhover: (id: number | null) => void;
		onselect: (hotspot: Hotspot) => void;
	};

	let { hotspots, hovered, onhover, onselect }: Props = $props();
</script>

<!-- Nearest first, as $geoNear returns them. Hovering or focusing a row highlights its circle. -->
<ol class="flex flex-col gap-2" aria-label="Hotspots, nearest first">
	{#each hotspots as hotspot (hotspot.id)}
		{@const p = hotspot.properties}
		{@const status = hotspotStatus[p.hotspot_status]}
		<li>
			<button
				type="button"
				class={cn(
					'bg-card hover:bg-accent/60 focus-visible:ring-ring/50 flex w-full items-start gap-3 rounded-md border p-3 text-left outline-none focus-visible:ring-[3px]',
					hovered === hotspot.id && 'bg-accent/60 border-foreground/30'
				)}
				onpointerenter={() => onhover(Number(hotspot.id))}
				onpointerleave={() => onhover(null)}
				onfocus={() => onhover(Number(hotspot.id))}
				onblur={() => onhover(null)}
				onclick={() => onselect(hotspot)}
				aria-label="Hotspot {p.rank}: {status.label}, {count(p.search_volume)} searches, {distance(p.avg_distance_meters)} away. Show on the map"
			>
				<span
					class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full"
					style:background-color="color-mix(in oklab, var({status.token}) 18%, transparent)"
					style:color="var({status.token})"
					aria-hidden="true"
				>
					<status.icon class="size-3.5" />
				</span>
				<span class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span class="text-body-sm flex flex-wrap items-baseline gap-x-2">
						<span class="font-semibold tabular-nums">{distance(p.avg_distance_meters)}</span>
						<span class="text-ink-secondary tabular-nums">{count(p.search_volume)} {p.search_volume === 1 ? 'search' : 'searches'}</span>
					</span>
					<span class="text-caption text-foreground font-medium">{status.label}</span>
					<span class="text-caption text-muted-foreground">
						{count(p.unique_users_count)} {p.unique_users_count === 1 ? 'person' : 'people'} · latest {relative(p.latest_search_at)}
					</span>
				</span>
				<span class="text-eyebrow text-muted-foreground tabular-nums">#{p.rank}</span>
			</button>
		</li>
	{/each}
</ol>
