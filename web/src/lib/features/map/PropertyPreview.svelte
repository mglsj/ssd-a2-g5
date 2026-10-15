<script lang="ts">
	import Building2Icon from '@lucide/svelte/icons/building-2';
	import { distance, rupees } from '#lib/format.js';
	import { cn } from '#lib/utils.js';
	import { tileFor } from '../properties/PropertyCard.svelte';
	import { photoFor, photoUrl } from '../properties/photos.js';

	/** The card in a property marker's popup: photo, name and nightly price. */
	type Props = { id: string; title: string; price: string; distanceMeters: number | null };

	let { id, title, price, distanceMeters }: Props = $props();

	const photo = $derived(photoFor(id));
	let failedPath = $state<string | null>(null);
</script>

<a href="/properties/{id}" data-slot="property-preview" class="group flex w-60 flex-col overflow-hidden rounded-[inherit] outline-none">
	<div class={cn('relative grid aspect-[16/10] place-items-center overflow-hidden', tileFor(id))}>
		<Building2Icon class="text-foreground/40 size-8" strokeWidth={1.25} aria-hidden="true" />
		{#if failedPath !== photo.path}
			<!-- An illustrative stock photo, so the alt text stays empty. -->
			<img
				src={photoUrl(photo, 480, 300)}
				alt=""
				width="480"
				height="300"
				decoding="async"
				onerror={() => (failedPath = photo.path)}
				class="absolute inset-0 size-full object-cover"
			/>
		{/if}
	</div>
	<div class="flex flex-col gap-0.5 px-3 py-2.5">
		<span class="text-body-sm text-foreground line-clamp-2 font-semibold group-hover:underline">{title}</span>
		<span class="text-caption text-muted-foreground">
			<span class="text-foreground font-medium tabular-nums">{rupees(price, { whole: true })}</span> / night
			{#if distanceMeters !== null}· {distance(distanceMeters)} away{/if}
		</span>
	</div>
</a>
