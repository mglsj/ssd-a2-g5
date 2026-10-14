<script lang="ts" module>
	import type { Snippet } from 'svelte';

	export type Column<T> = {
		key: string;
		header: string;
		cell: Snippet<[T]>;
		align?: 'left' | 'right';
		/** Extra classes for the table cells in this column. */
		class?: string;
		/** Leave the column out of the phone card, for example when the title already shows it. */
		hideInCard?: boolean;
	};
</script>

<script lang="ts" generics="T">
	import * as Table from '#lib/components/shadcn/table/index.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		items: T[];
		columns: Column<T>[];
		getKey: (item: T) => string;
		/** The card title on phones. Defaults to the first column. */
		title?: Snippet<[T]>;
		/** Makes each row a link. The first cell carries the link, stretched over the row. */
		rowHref?: (item: T) => string;
		rowLabel?: (item: T) => string;
		/** Actions shown at the end of each row and at the foot of each card. */
		actions?: Snippet<[T]>;
		caption?: string;
		class?: string;
	};

	let { items, columns, getKey, title, rowHref, rowLabel, actions, caption, class: className }: Props = $props();

	const [titleColumn, ...restColumns] = $derived(columns);
	const cardColumns = $derived(title ? columns : restColumns);
</script>

{#snippet link(item: T, content: Snippet)}
	{#if rowHref}
		<a
			href={rowHref(item)}
			aria-label={rowLabel?.(item)}
			class="text-foreground font-medium hover:underline focus-visible:outline-none after:absolute after:inset-0 focus-visible:after:ring-ring/50 focus-visible:after:ring-[3px] focus-visible:after:rounded-md"
		>
			{@render content()}
		</a>
	{:else}
		{@render content()}
	{/if}
{/snippet}

<div class={className}>
	<!-- md and up: a real table -->
	<div class="bg-card hidden overflow-hidden rounded-lg border md:block">
		<Table.Root>
			{#if caption}
				<Table.Caption class="sr-only">{caption}</Table.Caption>
			{/if}
			<Table.Header>
				<Table.Row>
					{#each columns as column (column.key)}
						<Table.Head class={cn(column.align === 'right' && 'text-right')}>{column.header}</Table.Head>
					{/each}
					{#if actions}
						<Table.Head><span class="sr-only">Actions</span></Table.Head>
					{/if}
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each items as item (getKey(item))}
					<Table.Row class={cn(rowHref && 'relative hover:bg-accent/60')}>
						{#each columns as column, i (column.key)}
							<Table.Cell class={cn(column.align === 'right' && 'text-right tabular-nums', column.class)}>
								{#if i === 0}
									{#snippet content()}{@render column.cell(item)}{/snippet}
									{@render link(item, content)}
								{:else}
									{@render column.cell(item)}
								{/if}
							</Table.Cell>
						{/each}
						{#if actions}
							<!-- Above the stretched link, so the buttons stay clickable. -->
							<Table.Cell class="relative z-10 text-right">
								<div class="flex justify-end gap-2">{@render actions(item)}</div>
							</Table.Cell>
						{/if}
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>

	<!-- Phones: stacked cards -->
	<ul class="flex flex-col gap-3 md:hidden" aria-label={caption}>
		{#each items as item (getKey(item))}
			<li class="bg-card relative flex flex-col gap-3 rounded-lg border p-4">
				<div class="text-body-md font-medium">
					{#snippet content()}
						{#if title}{@render title(item)}{:else}{@render titleColumn.cell(item)}{/if}
					{/snippet}
					{@render link(item, content)}
				</div>
				<dl class="text-body-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
					{#each cardColumns.filter((column) => !column.hideInCard) as column (column.key)}
						<dt class="text-muted-foreground">{column.header}</dt>
						<dd class={cn('min-w-0 text-right', column.align === 'right' && 'tabular-nums')}>
							{@render column.cell(item)}
						</dd>
					{/each}
				</dl>
				{#if actions}
					<div class="relative z-10 flex flex-wrap gap-2">{@render actions(item)}</div>
				{/if}
			</li>
		{/each}
	</ul>
</div>
