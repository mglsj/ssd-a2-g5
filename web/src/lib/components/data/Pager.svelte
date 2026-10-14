<script lang="ts">
	import * as Pagination from '#lib/components/shadcn/pagination/index.js';
	import { count } from '#lib/format.js';
	import { setParams } from '#lib/url.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		page: number;
		limit: number;
		total: number;
		/** Defaults to writing `page` into the URL as a new history entry. */
		onPageChange?: (page: number) => void;
		/** "bookings", "guests": used in "Showing 1–20 of 50,000 guests". */
		noun?: string;
		class?: string;
	};

	let { page, limit, total, onPageChange, noun = 'results', class: className }: Props = $props();

	const first = $derived(total === 0 ? 0 : (page - 1) * limit + 1);
	const last = $derived(Math.min(page * limit, total));

	function change(next: number) {
		if (next === page) return;
		if (onPageChange) onPageChange(next);
		else setParams({ page: next === 1 ? null : next }, { push: true });
	}
</script>

{#if total > 0}
	<div class={cn('flex flex-col items-center justify-between gap-3 sm:flex-row', className)}>
		<p class="text-caption text-muted-foreground tabular-nums" aria-live="polite">
			Showing {count(first)}–{count(last)} of {count(total)}
			{noun}
		</p>
		{#if total > limit}
			<Pagination.Root count={total} perPage={limit} {page} onPageChange={change} class="mx-0 w-auto">
				{#snippet children({ pages, currentPage })}
					<Pagination.Content>
						<Pagination.Item>
							<Pagination.Previous />
						</Pagination.Item>
						{#each pages as item (item.key)}
							{#if item.type === 'ellipsis'}
								<Pagination.Item class="hidden sm:block">
									<Pagination.Ellipsis />
								</Pagination.Item>
							{:else}
								<Pagination.Item class={cn(item.value !== currentPage && 'hidden sm:block')}>
									<Pagination.Link page={item} isActive={currentPage === item.value}>
										{count(item.value)}
									</Pagination.Link>
								</Pagination.Item>
							{/if}
						{/each}
						<Pagination.Item>
							<Pagination.Next />
						</Pagination.Item>
					</Pagination.Content>
				{/snippet}
			</Pagination.Root>
		{/if}
	</div>
{/if}
