<script lang="ts">
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import { page } from '$app/state';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import EmptyState from '#lib/components/states/EmptyState.svelte';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Page not found' : 'Something went wrong'} · StaySpot</title>
</svelte:head>

<EmptyState
	class="my-8"
	level={1}
	icon={notFound ? SearchXIcon : CircleAlertIcon}
	title={notFound ? 'Page not found' : 'Something went wrong'}
	description={notFound
		? `There is no page at ${page.url.pathname}. It may have moved, or the link has a typo.`
		: 'This page failed to load. Try reloading it.'}
>
	<div class="flex flex-wrap justify-center gap-2">
		<Button href="/">Go to the start page</Button>
		{#if !notFound}
			<Button variant="outline" onclick={() => location.reload()}>
				<RotateCwIcon data-icon="inline-start" />
				Reload
			</Button>
		{/if}
	</div>
	<p class="text-caption text-muted-foreground">Error {page.status}</p>
</EmptyState>
