<script lang="ts">
	import type { Density } from '#lib/api/queries.js';
	import { count } from '#lib/format.js';

	let { rings }: { rings: Density['items'] } = $props();

	const max = $derived(Math.max(1, ...rings.map((r) => r.pin_drops_count)));
</script>

<!-- Horizontal bars, one hue, value at the tip. The labels carry the numbers, so no axis is needed. -->
<ul class="flex flex-col gap-1.5" aria-label="Searches by distance from the chosen point">
	{#each rings as ring (ring.ring_start_km)}
		{@const label = `${ring.ring_start_km}–${ring.ring_end_km} km`}
		<li
			class="text-caption grid grid-cols-[3.5rem_1fr_auto] items-center gap-2"
			title="{label}: {count(ring.pin_drops_count)} searches by {count(ring.unique_searchers)} people"
		>
			<span class="text-muted-foreground tabular-nums">{label}</span>
			<span class="h-3">
				<span
					class="bg-chart-1 block h-full min-w-1 rounded-r-[4px]"
					style:width="{(ring.pin_drops_count / max) * 100}%"
				></span>
			</span>
			<span class="text-ink-secondary w-10 text-right tabular-nums">{count(ring.pin_drops_count)}</span>
		</li>
	{/each}
</ul>
