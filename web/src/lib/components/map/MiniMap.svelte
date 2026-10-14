<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';
	import '#lib/map/worker.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { FillLayer, GeoJSONSource, LineLayer, MapLibre, Marker, NavigationControl } from 'svelte-maplibre-gl';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import { queries } from '#lib/api/queries.js';
	import { MapTheme } from '#lib/map/theme.svelte.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		lat: number;
		lng: number;
		/** Accessible name for the map region. */
		label: string;
		/** Draws the search area around the point, in metres. */
		radius?: number;
		class?: string;
	};

	let { lat, lng, label, radius = 5000, class: className }: Props = $props();

	const theme = new MapTheme();
	const area = createQuery(() => queries.map.area({ lat: String(lat), lng: String(lng), radius: String(radius) }));
	let loaded = $state(false);
</script>

<div class={cn('bg-muted relative overflow-hidden rounded-lg border', className)} role="region" aria-label={label}>
	{#if !loaded}
		<Skeleton class="absolute inset-0 rounded-none" />
	{/if}
	<!-- Created once the colour mode is known. A later switch swaps the style in place. -->
	{#if theme.ready}
		<MapLibre
			class="h-full w-full"
			style={theme.style}
			center={[lng, lat]}
			zoom={11}
			autoloadGlobalCss={false}
			cooperativeGestures
			attributionControl={{ compact: true }}
			onload={() => (loaded = true)}
		>
			<NavigationControl position="top-right" showCompass={false} />
			{#if area.data}
				<GeoJSONSource data={area.data}>
					<FillLayer paint={{ 'fill-color': theme.colors.primary, 'fill-opacity': 0.08 }} />
					<LineLayer
						paint={{ 'line-color': theme.colors.primary, 'line-width': 1.5, 'line-dasharray': [3, 2] }}
					/>
				</GeoJSONSource>
			{/if}
			<Marker lnglat={[lng, lat]} color={theme.colors.primary} />
		</MapLibre>
	{/if}
</div>
