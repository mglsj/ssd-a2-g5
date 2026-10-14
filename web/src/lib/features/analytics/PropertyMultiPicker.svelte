<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { createQuery } from '@tanstack/svelte-query';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import * as Command from '#lib/components/shadcn/command/index.js';
	import * as Popover from '#lib/components/shadcn/popover/index.js';
	import { Spinner } from '#lib/components/shadcn/spinner/index.js';
	import { toApiError } from '#lib/api/errors.js';
	import { queries } from '#lib/api/queries.js';

	type Item = { id: string; title: string; color: string };

	type Props = {
		/** The compared properties, in their colour order. */
		selected: Item[];
		onchange: (ids: string[]) => void;
		max?: number;
	};

	let { selected, onchange, max = 5 }: Props = $props();

	let open = $state(false);
	let search = $state('');
	let debounced = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;

	const results = createQuery(() => ({
		...queries.properties.list({ q: debounced.trim(), sort: 'revenue', limit: '8' }),
		enabled: open
	}));

	const ids = $derived(selected.map((s) => s.id));
	const full = $derived(selected.length >= max);

	function onSearch(next: string) {
		search = next;
		clearTimeout(timer);
		timer = setTimeout(() => (debounced = next), 250);
	}

	function toggle(id: string) {
		if (ids.includes(id)) onchange(ids.filter((x) => x !== id));
		else if (!full) onchange([...ids, id]);
	}
</script>

<div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Compared properties">
	{#each selected as item (item.id)}
		<span class="bg-muted text-caption inline-flex max-w-72 items-center gap-1.5 rounded-full py-1 pr-1 pl-2.5">
			<span class="h-0.5 w-3 shrink-0 rounded-full" style:background-color="var({item.color})" aria-hidden="true"></span>
			<span class="truncate">{item.title}</span>
			<button
				type="button"
				class="hover:bg-accent focus-visible:ring-ring/50 grid size-5 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-[3px] disabled:opacity-40"
				aria-label="Remove {item.title}"
				disabled={selected.length <= 1}
				title={selected.length <= 1 ? 'Keep at least one property' : undefined}
				onclick={() => toggle(item.id)}
			>
				<XIcon class="size-3" />
			</button>
		</span>
	{/each}

	<Popover.Root bind:open>
		<Popover.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="outline" size="sm" disabled={full} title={full ? `Compare at most ${max}` : undefined}>
					<PlusIcon data-icon="inline-start" />
					{full ? `${max} of ${max}` : 'Add property'}
				</Button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content class="w-80 p-0" align="start">
			<Command.Root shouldFilter={false} label="Add a property to the chart">
				<Command.Input
					placeholder="Search properties by title…"
					aria-label="Search properties by title"
					value={search}
					oninput={(event) => onSearch(event.currentTarget.value)}
				/>
				<Command.List>
					{#if results.isPending}
						<Command.Loading>
							<div class="text-muted-foreground flex items-center gap-2 px-2 py-3 text-sm"><Spinner /> Searching…</div>
						</Command.Loading>
					{:else if results.isError}
						<p class="text-destructive px-2 py-3 text-sm">{toApiError(results.error).message}</p>
					{:else if results.data.items.length === 0}
						<p class="text-muted-foreground px-2 py-3 text-sm">Nothing matches “{debounced}”.</p>
					{:else}
						<Command.Group heading={debounced ? 'Matching properties' : 'Highest revenue'}>
							{#each results.data.items as p (p.id)}
								{@const chosen = ids.includes(p.id)}
								<Command.Item
									value={p.id}
									onSelect={() => toggle(p.id)}
									disabled={!chosen && full}
									data-checked={chosen}
									aria-selected={chosen}
								>
									<span class="min-w-0 flex-1 truncate">{p.title}</span>
									{#if chosen}<span class="text-caption text-muted-foreground">Shown</span>{/if}
								</Command.Item>
							{/each}
						</Command.Group>
					{/if}
				</Command.List>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>
</div>
