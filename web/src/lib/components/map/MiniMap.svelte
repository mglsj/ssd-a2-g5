<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';
	import '#lib/map/worker.js';
	import { MapLibre, Marker, NavigationControl } from 'svelte-maplibre-gl';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import { MapTheme } from '#lib/map/theme.svelte.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		lat: number;
		lng: number;
		/** Accessible name for the map region. */
		label: string;
		class?: string;
	};

	let { lat, lng, label, class: className }: Props = $props();

	const theme = new MapTheme();
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
			zoom={14}
			autoloadGlobalCss={false}
			cooperativeGestures
			attributionControl={{ compact: true }}
			onload={() => (loaded = true)}
		>
			<NavigationControl position="top-right" showCompass={false} />
			<Marker lnglat={[lng, lat]} color={theme.colors.primary} />
		</MapLibre>
	{/if}
</div>
