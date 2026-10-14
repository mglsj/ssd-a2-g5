<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';
	import '#lib/map/worker.js';
	import BedDoubleIcon from '@lucide/svelte/icons/bed-double';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import ListIcon from '@lucide/svelte/icons/list';
	import MapPinPlusIcon from '@lucide/svelte/icons/map-pin-plus';
	import RadioIcon from '@lucide/svelte/icons/radio';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import XIcon from '@lucide/svelte/icons/x';
	import { createMutation, createQuery } from '@tanstack/svelte-query';
	import type * as maplibregl from 'maplibre-gl';
	import {
		CircleLayer,
		FillLayer,
		GeoJSONSource,
		HeatmapLayer,
		LineLayer,
		MapLibre,
		Marker,
		NavigationControl,
		SymbolLayer
	} from 'svelte-maplibre-gl';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import * as Card from '#lib/components/shadcn/card/index.js';
	import * as Sheet from '#lib/components/shadcn/sheet/index.js';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import { Spinner } from '#lib/components/shadcn/spinner/index.js';
	import * as ToggleGroup from '#lib/components/shadcn/toggle-group/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import ErrorState from '#lib/components/states/ErrorState.svelte';
	import DensityBars from '#lib/features/map/DensityBars.svelte';
	import HotspotList from '#lib/features/map/HotspotList.svelte';
	import OriginPicker from '#lib/features/map/OriginPicker.svelte';
	import { FRESH_MS, LivePins } from '#lib/features/map/live-pins.svelte.js';
	import { toApiError } from '#lib/api/errors.js';
	import { mutations, queries, type Hotspot } from '#lib/api/queries.js';
	import { count } from '#lib/format.js';
	import { createLodgingIcon } from '#lib/map/lodging-icon.js';
	import { IIIT, MapTheme, rgba } from '#lib/map/theme.svelte.js';
	import { Clock } from '#lib/clock.svelte.js';
	import { motionMs, reducedMotion } from '#lib/motion.svelte.js';
	import { getActor } from '#lib/state/actor.svelte.js';
	import { setParams, stringParam } from '#lib/url.js';

	const RADIUS = 5000;
	const SEEDER = 'uv run --project data_generation python data_generation/mongo_seeder.py --sessions 0 --live';

	const actor = getActor();
	const theme = new MapTheme();

	// The origin lives in the URL, so a shared link opens the same search window.
	function coordinate(name: string, fallback: number, limit: number) {
		const value = Number(stringParam(name));
		return stringParam(name) !== '' && Number.isFinite(value) && Math.abs(value) <= limit ? value : fallback;
	}
	const lat = $derived(coordinate('lat', IIIT.lat, 90));
	const lng = $derived(coordinate('lng', IIIT.lng, 180));
	const isIIIT = $derived(lat === IIIT.lat && lng === IIIT.lng);
	const originLabel = $derived(stringParam('origin') || (isIIIT ? 'IIIT Hyderabad' : `${lat.toFixed(4)}, ${lng.toFixed(4)}`));

	const searchWindow = $derived({ lat: String(lat), lng: String(lng), radius: String(RADIUS) });
	const area = createQuery(() => queries.map.area(searchWindow));
	const hotspots = createQuery(() => queries.map.hotspots(searchWindow));
	const density = createQuery(() => queries.map.density(searchWindow));
	const properties = createQuery(() => queries.map.properties(searchWindow));

	// One poller per origin. It loads all pins, then asks every 5 s for pins after its cursor.
	const live = $derived(new LivePins({ lat, lng }));
	$effect(() => {
		// Capture this instance: by cleanup time `live` already names the next origin's poller.
		const poller = live;
		poller.start();
		return () => poller.stop();
	});

	// A 1 s clock for "updated N s ago" and for the pulse on new pins.
	const clock = new Clock(1000);

	const pinData = $derived({ type: 'FeatureCollection' as const, features: live.pins });
	const freshData = $derived.by(() => {
		const now = clock.now;
		return {
			type: 'FeatureCollection' as const,
			features: live.pins
				.filter((pin) => live.arrived.has(String(pin.id)) && now - live.arrived.get(String(pin.id))! < FRESH_MS)
				.map((pin) => ({
					...pin,
					// With reduced motion the ring holds still at a mid age, then disappears.
					properties: { ...pin.properties, age: reducedMotion.current ? 0.2 : (now - live.arrived.get(String(pin.id))!) / FRESH_MS }
				}))
		};
	});

	const features = $derived(hotspots.data?.features ?? []);
	const empty = $derived(!hotspots.isPending && !live.loading && features.length === 0 && live.pins.length === 0);

	let layers = $state<string[]>(['heat', 'properties']);
	let hovered = $state<number | null>(null);
	let dropping = $state(false);
	let panelOpen = $state(false);
	let map = $state<maplibregl.Map | undefined>();
	// The view's own centre, bound to the map. It starts at the origin and then follows the map.
	// The origin is not passed as `center`: the component would jumpTo it and cancel the pan below.
	// svelte-ignore state_referenced_locally
	let center = $state<[number, number]>([lng, lat]);

	// The property marker, redrawn when the colour mode changes. Sharp at the screen's pixel ratio.
	// Not "lodging": the basemap sprite already has an icon by that name.
	const LODGING = 'stayspot-lodging';
	const iconRatio = Math.max(2, Math.ceil(globalThis.devicePixelRatio ?? 1));
	let lodgingIcon = $state<HTMLImageElement | null>(null);
	$effect(() => {
		let current = true;
		const colors = { fill: theme.colors.lodging, icon: theme.colors.lodgingForeground, ring: theme.colors.card };
		createLodgingIcon(colors, iconRatio).then((image) => current && (lodgingIcon = image));
		return () => (current = false);
	});

	// A style swap drops added images, and <Image> then fails removing them. So the map gets the
	// marker here, and again whenever it reports the image missing after a swap.
	function addLodgingIcon(m: maplibregl.Map) {
		if (!lodgingIcon) return;
		if (m.hasImage(LODGING)) m.updateImage(LODGING, lodgingIcon);
		else m.addImage(LODGING, lodgingIcon, { pixelRatio: iconRatio });
	}
	$effect(() => {
		if (map && lodgingIcon) addLodgingIcon(map);
	});

	const visibility = (layer: string) => ({ visibility: layers.includes(layer) ? ('visible' as const) : ('none' as const) });

	// Pan smoothly to a new origin (a map click, the picker or the Back button), keeping the zoom.
	$effect(() => {
		map?.easeTo({ center: [lng, lat], duration: motionMs(1000) });
	});

	// MapLibre throws on feature state while a style loads, which happens when the colour mode switches.
	// So the hover ring is set here, only while the style is ready, rather than with <FeatureState>.
	let styleReady = $state(false);
	$effect(() => {
		const m = map;
		const id = hovered;
		void hotspots.data;
		if (!m || id === null || !styleReady || !m.getSource('hotspots')) return;
		m.setFeatureState({ source: 'hotspots', id }, { hover: true });
		return () => {
			if (m.isStyleLoaded() && m.getSource('hotspots')) m.removeFeatureState({ source: 'hotspots', id }, 'hover');
		};
	});

	const drop = createMutation(() => ({
		mutationFn: (point: { lat: number; lng: number }) =>
			mutations.dropPin({ ...point, ...(actor.guestId ? { user_id: actor.guestId } : {}) }),
		onSuccess: (pin) => {
			live.add(pin);
			toast.success('Pin dropped', { description: 'It counts towards the hotspots on the next refresh.' });
		},
		onError: (error) => toast.error(toApiError(error).message)
	}));

	function onMapClick(event: maplibregl.MapMouseEvent) {
		const point = { lat: Number(event.lngLat.lat.toFixed(5)), lng: Number(event.lngLat.lng.toFixed(5)) };
		if (dropping) {
			dropping = false;
			drop.mutate(point);
		} else {
			setParams({ lat: point.lat, lng: point.lng, origin: null });
		}
	}

	function setOrigin(origin: { lat: number; lng: number; label: string } | null) {
		setParams(origin ? { lat: origin.lat, lng: origin.lng, origin: origin.label } : { lat: null, lng: null, origin: null });
	}

	function select(hotspot: Hotspot) {
		const [x, y] = hotspot.geometry.coordinates;
		map?.flyTo({ center: [x, y], zoom: 14, duration: motionMs(500) });
		panelOpen = false;
	}

	const updatedText = $derived.by(() => {
		if (live.paused) return 'Paused while the tab is hidden';
		if (live.error) return 'Live updates failed, retrying';
		if (live.updatedAt === null) return 'Connecting…';
		const seconds = Math.max(0, Math.round((clock.now - live.updatedAt) / 1000));
		return `Live · updated ${seconds} s ago`;
	});

	// Search density is a magnitude, so the heat ramp is one hue (chart-2 orange) from clear to deep.
	const heatColor = $derived.by(() => {
		const hue = theme.colors.chart[1];
		return [
			'interpolate',
			['linear'],
			['heatmap-density'],
			0,
			rgba(hue, 0),
			0.2,
			rgba(hue, 0.2),
			0.5,
			rgba(hue, 0.45),
			0.8,
			rgba(hue, 0.7),
			1,
			rgba(hue, 0.85, 0.8)
		] as maplibregl.ExpressionSpecification;
	});

	async function copySeeder() {
		try {
			await navigator.clipboard.writeText(SEEDER);
			toast.success('Command copied');
		} catch {
			toast.error('Could not copy. Select the command and copy it instead.');
		}
	}
</script>

{#snippet panel()}
	<div class="flex flex-col gap-5">
		<div class="flex flex-col gap-1">
			<h2 class="text-title">Hotspots near {originLabel}</h2>
			<p class="text-caption text-muted-foreground">Within 5 km · last 2 hours · nearest first ($geoNear on SearchSessions)</p>
		</div>
		{#if hotspots.isPending}
			<div class="flex flex-col gap-2">
				{#each { length: 4 }, i (i)}<Skeleton class="h-20 w-full" />{/each}
			</div>
		{:else if hotspots.isError}
			<ErrorState error={hotspots.error} onretry={() => hotspots.refetch()} retrying={hotspots.isFetching} />
		{:else if features.length === 0}
			<p class="text-body-sm text-muted-foreground">No hotspots in this window yet.</p>
		{:else}
			<HotspotList hotspots={features} {hovered} onhover={(id) => (hovered = id)} onselect={select} />
		{/if}

		<section class="flex flex-col gap-2" aria-labelledby="density-heading">
			<h3 id="density-heading" class="text-eyebrow text-muted-foreground uppercase">Pins by distance</h3>
			{#if density.isPending}
				<Skeleton class="h-24 w-full" />
			{:else if density.isError}
				<ErrorState error={density.error} onretry={() => density.refetch()} retrying={density.isFetching} />
			{:else if density.data.items.length === 0}
				<p class="text-body-sm text-muted-foreground">No pins in the last 2 hours.</p>
			{:else}
				<DensityBars rings={density.data.items} />
			{/if}
		</section>

		<section class="flex flex-col gap-2" aria-labelledby="legend-heading">
			<h3 id="legend-heading" class="text-eyebrow text-muted-foreground uppercase">Legend</h3>
			<ul class="text-caption grid grid-cols-2 gap-x-3 gap-y-1.5">
				<li class="col-span-2 flex flex-col gap-1">
					<span
						class="h-2 w-full rounded-full"
						style:background="linear-gradient(to right, color-mix(in oklab, var(--chart-2) 15%, transparent), var(--chart-2), color-mix(in oklab, var(--chart-2) 65%, black))"
						aria-hidden="true"
					></span>
					<span class="text-muted-foreground flex justify-between"><span>Fewer searches</span><span>More searches</span></span>
				</li>
				<li class="flex items-center gap-1.5">
					<span class="ring-foreground size-2.5 rounded-full ring-2" aria-hidden="true"></span> New ping
				</li>
				<li class="flex items-center gap-1.5">
					<span class="bg-map-lodging text-map-lodging-foreground grid size-4 place-items-center rounded-full" aria-hidden="true">
						<BedDoubleIcon class="size-2.5" strokeWidth={2.5} />
					</span>
					Property
				</li>
			</ul>
		</section>
	</div>
{/snippet}

<svelte:head>
	<title>Map · StaySpot</title>
</svelte:head>

<svelte:window onkeydown={(event) => event.key === 'Escape' && (dropping = false)} />

<PageHeader title="Map" description="Where people are searching for stays right now, around a point you choose." />

<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
	<div class="relative h-[60vh] min-h-96 overflow-hidden rounded-lg border lg:h-[calc(100dvh-14rem)]">
		<!-- Created once the colour mode is known, so it does not load the light style and then swap. -->
		{#if theme.ready}
			<MapLibre
				bind:map
				class="h-full w-full"
				style={theme.style}
				bind:center
				zoom={12.3}
				autoloadGlobalCss={false}
				attributionControl={{ compact: true }}
				cursor={dropping ? 'crosshair' : undefined}
				onclick={onMapClick}
				onstyledataloading={() => (styleReady = false)}
				onidle={() => (styleReady = true)}
				onstyleimagemissing={(event) => event.id === LODGING && addLodgingIcon(event.target)}
			>
				<NavigationControl position="top-right" showCompass={false} />
	
				{#if area.data}
					<GeoJSONSource id="area" data={area.data}>
						<FillLayer paint={{ 'fill-color': theme.colors.primary, 'fill-opacity': 0.07 }} />
						<LineLayer paint={{ 'line-color': theme.colors.primary, 'line-width': 1.5, 'line-dasharray': [3, 2] }} />
					</GeoJSONSource>
				{/if}
	
				<!-- Every live pin feeds the heatmap. Each counts once; overlap is what makes it hot. -->
				<GeoJSONSource id="pins" data={pinData} promoteId="id">
					<HeatmapLayer
						layout={visibility('heat')}
						paint={{
							'heatmap-weight': 1,
							'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.15, 13, 0.3, 16, 0.8],
							'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 10, 13, 20, 16, 40],
							'heatmap-color': heatColor,
							'heatmap-opacity': 0.9
						}}
					/>
				</GeoJSONSource>
	
				<!-- New pings pulse: an ink ring that grows and fades over four seconds. -->
				<GeoJSONSource id="fresh-pins" data={freshData}>
					<CircleLayer
						layout={visibility('heat')}
						paint={{
							'circle-radius': ['interpolate', ['linear'], ['get', 'age'], 0, 3, 1, 14],
							'circle-color': theme.colors.foreground,
							'circle-opacity': ['interpolate', ['linear'], ['get', 'age'], 0, 0.8, 0.3, 0.2, 1, 0],
							'circle-stroke-color': theme.colors.foreground,
							'circle-stroke-width': 1.5,
							'circle-stroke-opacity': ['interpolate', ['linear'], ['get', 'age'], 0, 1, 1, 0]
						}}
					/>
				</GeoJSONSource>
	
				<!-- Stays: round pink markers with a bed, above the heatmap. -->
				{#if properties.data}
					<GeoJSONSource id="properties" data={properties.data} promoteId="id">
						<SymbolLayer
							layout={{
								...visibility('properties'),
								'icon-image': LODGING,
								'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.55, 13, 0.85, 16, 1],
								'icon-allow-overlap': true,
								'icon-ignore-placement': true
							}}
						/>
					</GeoJSONSource>
				{/if}
	
				<!-- The $geoNear hotspots stay invisible until one is hovered here or in the list, then show as a ring. -->
				{#if hotspots.data}
					<GeoJSONSource id="hotspots" data={hotspots.data}>
						<CircleLayer
							paint={{
								'circle-radius': ['interpolate', ['linear'], ['get', 'search_volume'], 1, 10, 10, 16, 40, 26, 150, 34],
								'circle-color': theme.colors.foreground,
								'circle-opacity': 0,
								'circle-stroke-color': theme.colors.foreground,
								'circle-stroke-width': 2,
								'circle-stroke-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0]
							}}
							onmousemove={(event) => {
								const id = event.features?.[0]?.id;
								hovered = typeof id === 'number' ? id : null;
							}}
							onmouseleave={() => (hovered = null)}
						/>
					</GeoJSONSource>
				{/if}
	
				<Marker lnglat={[lng, lat]} color={theme.colors.primary} />
			</MapLibre>
		{/if}

		<!-- Controls over the map -->
		<div class="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start gap-2 pr-12">
			<div class="pointer-events-auto"><OriginPicker label={originLabel} onchange={setOrigin} /></div>
			<ToggleGroup.Root
				type="multiple"
				variant="outline"
				aria-label="Map layers"
				bind:value={layers}
				class="bg-card pointer-events-auto"
			>
				<ToggleGroup.Item value="heat" class="data-[state=off]:text-muted-foreground px-3">Heatmap</ToggleGroup.Item>
				<ToggleGroup.Item value="properties" class="data-[state=off]:text-muted-foreground px-3">Properties</ToggleGroup.Item>
			</ToggleGroup.Root>
		</div>

		<!-- Raised above the attribution, which MapLibre pins to the bottom edge. -->
		<div class="pointer-events-none absolute inset-x-3 bottom-16 flex flex-col-reverse items-start gap-2 sm:bottom-10 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
			<div class="pointer-events-auto flex flex-wrap gap-2">
				{#if dropping}
					<Button onclick={() => (dropping = false)} variant="secondary" class="shadow-soft">
						<XIcon data-icon="inline-start" />
						Cancel
					</Button>
					<p class="bg-card text-body-sm shadow-soft self-center rounded-md px-3 py-1.5" role="status">
						Click the map to drop a pin
					</p>
				{:else}
					<Button onclick={() => (dropping = true)} disabled={drop.isPending} class="shadow-soft">
						{#if drop.isPending}<Spinner data-icon="inline-start" />{:else}<MapPinPlusIcon data-icon="inline-start" />{/if}
						Drop a pin
					</Button>
				{/if}
				<Sheet.Root bind:open={panelOpen}>
					<Sheet.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="secondary" class="shadow-soft lg:hidden">
								<ListIcon data-icon="inline-start" />
								Hotspots ({count(features.length)})
							</Button>
						{/snippet}
					</Sheet.Trigger>
					<Sheet.Content side="bottom" class="max-h-[75dvh] overflow-y-auto overscroll-contain">
						<Sheet.Header class="sr-only">
							<Sheet.Title>Hotspots</Sheet.Title>
							<Sheet.Description>Search hotspots around {originLabel}</Sheet.Description>
						</Sheet.Header>
						<div class="px-4 pt-6 pb-6">{@render panel()}</div>
					</Sheet.Content>
				</Sheet.Root>
			</div>
			<p class="bg-card text-caption shadow-soft pointer-events-auto flex items-center gap-1.5 rounded-full px-3 py-1.5" aria-live="off">
				<RadioIcon class={live.error || live.paused ? 'text-muted-foreground size-3.5' : 'text-success size-3.5'} aria-hidden="true" />
				<span class="tabular-nums">{updatedText}</span>
				<span class="text-muted-foreground">· {count(live.pins.length)} pins</span>
			</p>
		</div>

		<!-- Hidden while dropping, so the click reaches the map. -->
		{#if empty && !dropping}
			<div class="absolute inset-0 grid place-items-center bg-black/10 p-4">
				<Card.Root class="max-w-md" elevated>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<SearchXIcon class="size-5" aria-hidden="true" />
							No searches in the last 2 hours
						</Card.Title>
						<Card.Description>
							Search pins expire after 2 hours (a TTL index). Start the live seeder in the dev container to stream new
							ones, or drop a pin yourself.
						</Card.Description>
					</Card.Header>
					<Card.Content class="flex flex-col gap-2">
						<code class="bg-muted text-caption block rounded-md p-3 break-all select-all">{SEEDER}</code>
						<div class="flex flex-wrap gap-2">
							<Button size="sm" variant="outline" onclick={copySeeder}>
								<CopyIcon data-icon="inline-start" />
								Copy command
							</Button>
							<Button size="sm" onclick={() => (dropping = true)}>
								<MapPinPlusIcon data-icon="inline-start" />
								Drop a pin
							</Button>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		{/if}
	</div>

	<Card.Root class="hidden lg:flex">
		<Card.Content>{@render panel()}</Card.Content>
	</Card.Root>
</div>
