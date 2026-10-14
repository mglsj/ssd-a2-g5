<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { QueryCache, QueryClient, QueryClientProvider, hashKey } from '@tanstack/svelte-query';
	import { ModeWatcher } from 'mode-watcher';
	import { page } from '$app/state';
	import { Toaster } from '#lib/components/shadcn/sonner/index.js';
	import AppShell from '#lib/components/app/AppShell.svelte';
	import { isRetryable, toApiError } from '#lib/api/errors.js';
	import { keys } from '#lib/api/queries.js';
	import { Actor, setActor } from '#lib/state/actor.svelte.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const actor = new Actor();
	setActor(actor);

	const queryClient = new QueryClient({
		queryCache: new QueryCache({
			// A reseed replaces every guest, so a remembered guest id can go stale. Forget it.
			onError: (error, query) => {
				const isActorGuest = query.queryHash === hashKey(keys.guests.detail(actor.guestId ?? ''));
				if (isActorGuest && toApiError(error).code === 'NOT_FOUND') actor.guestId = null;
			}
		}),
		defaultOptions: {
			queries: {
				staleTime: 30_000,
				// A 4xx fails the same way again, so only network and server errors are retried.
				retry: (failures, error) => failures < 2 && isRetryable(error)
			}
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ModeWatcher defaultMode="light" />
<Toaster position="bottom-right" />

<QueryClientProvider client={queryClient}>
	{#if page.route.id === '/design'}
		<!-- The design system page has its own full-bleed layout. -->
		{@render children()}
	{:else}
		<div class="flex min-h-dvh flex-col">
			<AppShell>
				{@render children()}
			</AppShell>
		</div>
	{/if}
</QueryClientProvider>
