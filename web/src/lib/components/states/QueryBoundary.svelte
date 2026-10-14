<script lang="ts" generics="T">
	import type { CreateQueryResult } from '@tanstack/svelte-query';
	import { cn } from '#lib/utils.js';
	import type { Snippet } from 'svelte';
	import EmptyState from './EmptyState.svelte';
	import ErrorState from './ErrorState.svelte';
	import LoadingState from './LoadingState.svelte';

	type Props = {
		query: CreateQueryResult<T>;
		/** Decides when data counts as empty, for example a page with no items. */
		isEmpty?: (data: T) => boolean;
		/** A skeleton in the shape of the content. Defaults to three rows. */
		loading?: Snippet;
		/** An Empty with a next step. Defaults to a plain "Nothing here". */
		empty?: Snippet;
		/** Extra actions on the error alert. */
		errorActions?: Snippet<[unknown]>;
		children: Snippet<[T]>;
	};

	let { query, isEmpty, loading, empty, errorActions, children }: Props = $props();
</script>

{#if query.isPending}
	{#if loading}
		<div role="status" aria-live="polite" class="contents">
			<span class="sr-only">Loading</span>
			{@render loading()}
		</div>
	{:else}
		<LoadingState />
	{/if}
{:else if query.isError}
	<ErrorState error={query.error} onretry={() => query.refetch()} retrying={query.isFetching}>
		{#if errorActions}
			{@render errorActions(query.error)}
		{/if}
	</ErrorState>
{:else if isEmpty?.(query.data)}
	{#if empty}
		{@render empty()}
	{:else}
		<EmptyState title="Nothing here" />
	{/if}
{:else}
	<!-- Placeholder data from the previous page stays visible, dimmed, while the next one loads. -->
	<div
		class={cn('contents', query.isPlaceholderData && '*:opacity-60 *:transition-opacity')}
		aria-busy={query.isFetching}
	>
		{@render children(query.data)}
	</div>
{/if}
