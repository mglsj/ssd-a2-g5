<script lang="ts">
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import GraduationCapIcon from '@lucide/svelte/icons/graduation-cap';
	import HouseIcon from '@lucide/svelte/icons/house';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import { createQuery } from '@tanstack/svelte-query';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import * as Command from '#lib/components/shadcn/command/index.js';
	import * as Popover from '#lib/components/shadcn/popover/index.js';
	import { Spinner } from '#lib/components/shadcn/spinner/index.js';
	import { toApiError } from '#lib/api/errors.js';
	import { queries } from '#lib/api/queries.js';

	type Origin = { lat: number; lng: number; label: string };

	type Props = {
		label: string;
		/** null resets to IIIT Hyderabad. */
		onchange: (origin: Origin | null) => void;
	};

	let { label, onchange }: Props = $props();

	let open = $state(false);
	let search = $state('');
	let debounced = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;

	const results = createQuery(() => ({
		...queries.properties.list({ q: debounced.trim(), limit: '8' }),
		enabled: open && debounced.trim() !== ''
	}));

	function onSearch(next: string) {
		search = next;
		clearTimeout(timer);
		timer = setTimeout(() => (debounced = next), 250);
	}

	function choose(origin: Origin | null) {
		onchange(origin);
		open = false;
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" role="combobox" aria-expanded={open} class="bg-card max-w-72 justify-between">
				<MapPinIcon data-icon="inline-start" />
				<span class="truncate">Origin: {label}</span>
				<ChevronsUpDownIcon data-icon="inline-end" class="opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-80 p-0" align="start">
		<Command.Root shouldFilter={false} label="Choose the search origin">
			<Command.Input
				placeholder="Search a property…"
				aria-label="Search a property to use as the origin"
				value={search}
				oninput={(event) => onSearch(event.currentTarget.value)}
			/>
			<Command.List>
				<Command.Group heading="Origin">
					<Command.Item value="iiit" onSelect={() => choose(null)}>
						<GraduationCapIcon />
						IIIT Hyderabad
					</Command.Item>
				</Command.Group>
				{#if debounced.trim()}
					<Command.Group heading="Properties">
						{#if results.isPending}
							<Command.Loading>
								<div class="text-muted-foreground flex items-center gap-2 px-2 py-3 text-sm"><Spinner /> Searching…</div>
							</Command.Loading>
						{:else if results.isError}
							<p class="text-destructive px-2 py-3 text-sm">{toApiError(results.error).message}</p>
						{:else if results.data.items.length === 0}
							<p class="text-muted-foreground px-2 py-3 text-sm">Nothing matches “{debounced}”.</p>
						{:else}
							{#each results.data.items as p (p.id)}
								<Command.Item value={p.id} onSelect={() => choose({ lat: p.latitude, lng: p.longitude, label: p.title })}>
									<HouseIcon />
									<span class="truncate">{p.title}</span>
								</Command.Item>
							{/each}
						{/if}
					</Command.Group>
				{/if}
			</Command.List>
			<p class="text-caption text-muted-foreground border-t px-3 py-2">You can also click the map to move the origin.</p>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
