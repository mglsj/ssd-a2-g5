<script lang="ts">
	import Building2Icon from '@lucide/svelte/icons/building-2';
	import { cn } from '#lib/utils.js';
	import { authorUrl, photoFor, photoSrcset, photoUrl, unsplashUrl } from './photos.js';
	import { tileFor } from './PropertyCard.svelte';

	/** The large photo on the property page, with the credit Unsplash asks for. */
	let { propertyId, class: className }: { propertyId: string; class?: string } = $props();

	const photo = $derived(photoFor(propertyId));
	// Remember which photo failed: the page is reused when moving to another property.
	let failedPath = $state<string | null>(null);
	const failed = $derived(failedPath === photo.path);
</script>

<figure class={cn('flex flex-col gap-2', className)}>
	<div class={cn('relative grid aspect-[16/9] place-items-center overflow-hidden rounded-lg sm:aspect-[21/9]', tileFor(propertyId))}>
		<Building2Icon class="text-foreground/40 size-14" strokeWidth={1.25} aria-hidden="true" />
		{#if !failed}
			<img
				src={photoUrl(photo, 1280, 549)}
				srcset={photoSrcset(photo, [640, 960, 1280, 1920], 21 / 9)}
				sizes="(min-width: 1024px) 760px, 100vw"
				alt="Illustrative photo: {photo.alt.charAt(0).toLowerCase()}{photo.alt.slice(1)}"
				decoding="async"
				fetchpriority="high"
				width="1280"
				height="549"
				onerror={() => (failedPath = photo.path)}
				class="absolute inset-0 size-full object-cover"
			/>
		{/if}
	</div>
	{#if !failed}
		<figcaption class="text-caption text-muted-foreground">
			Illustrative photo by <a href={authorUrl(photo)} target="_blank" rel="noopener noreferrer">{photo.author}</a>
			on <a href={unsplashUrl} target="_blank" rel="noopener noreferrer">Unsplash</a>. Not a photo of this property.
		</figcaption>
	{/if}
</figure>
