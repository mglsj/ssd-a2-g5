<script lang="ts">
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import XIcon from '@lucide/svelte/icons/x';
	import { createQuery } from '@tanstack/svelte-query';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import * as Command from '#lib/components/shadcn/command/index.js';
	import { Label } from '#lib/components/shadcn/label/index.js';
	import * as Popover from '#lib/components/shadcn/popover/index.js';
	import { Spinner } from '#lib/components/shadcn/spinner/index.js';
	import { toApiError } from '#lib/api/errors.js';
	import { queries } from '#lib/api/queries.js';
	import { rupees } from '#lib/format.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		kind: 'guest' | 'property';
		id: string;
		label: string;
		value: string | null;
		onchange: (id: string | null) => void;
		/** Text on the trigger when nothing is chosen, such as "Any guest". */
		placeholder?: string;
		class?: string;
	};

	let { kind, id, label, value, onchange, placeholder, class: className }: Props = $props();

	let open = $state(false);
	let search = $state('');
	let debounced = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;

	const noun = $derived(kind === 'guest' ? 'guest' : 'property');

	// Resolves the chosen id from the URL into a name for the trigger.
	const guest = createQuery(() => ({
		...queries.guests.detail(value ?? ''),
		enabled: kind === 'guest' && value !== null
	}));
	const property = createQuery(() => ({
		...queries.properties.detail(value ?? ''),
		enabled: kind === 'property' && value !== null
	}));

	const guests = createQuery(() => ({
		...queries.guests.list({ q: debounced.trim(), limit: '8' }),
		enabled: open && kind === 'guest'
	}));
	const properties = createQuery(() => ({
		...queries.properties.list({ q: debounced.trim(), limit: '8' }),
		enabled: open && kind === 'property'
	}));

	type Option = { id: string; name: string; hint: string };

	const results = $derived(kind === 'guest' ? guests : properties);
	const options = $derived.by((): Option[] => {
		if (kind === 'guest') {
			return (guests.data?.items ?? []).map((g) => ({ id: g.id, name: g.name, hint: rupees(g.wallet_balance) }));
		}
		return (properties.data?.items ?? []).map((p) => ({
			id: p.id,
			name: p.title,
			hint: `${rupees(p.base_price, { whole: true })} / night`
		}));
	});

	const selected = $derived(kind === 'guest' ? guest : property);
	const selectedName = $derived(
		kind === 'guest' ? guest.data?.name : property.data?.title
	);
	const triggerText = $derived(
		value === null
			? (placeholder ?? `Any ${noun}`)
			: (selectedName ?? (selected.isError ? `Unknown ${noun}` : 'Loading…'))
	);

	function onSearch(next: string) {
		search = next;
		clearTimeout(timer);
		timer = setTimeout(() => (debounced = next), 250);
	}

	function choose(next: string | null) {
		onchange(next);
		open = false;
	}
</script>

<div class={cn('flex min-w-0 flex-col gap-1.5', className)}>
	<Label for={id}>{label}</Label>
	<div class="flex min-w-0 gap-1">
		<Popover.Root bind:open>
			<Popover.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						{id}
						variant="outline"
						role="combobox"
						aria-expanded={open}
						class="min-w-0 flex-1 justify-between font-normal"
					>
						<span class={cn('truncate', value === null && 'text-muted-foreground')}>{triggerText}</span>
						<ChevronsUpDownIcon data-icon="inline-end" class="opacity-50" />
					</Button>
				{/snippet}
			</Popover.Trigger>
			<Popover.Content class="w-(--bits-popover-anchor-width) min-w-72 p-0" align="start">
				<Command.Root shouldFilter={false} label="Choose a {noun}">
					<Command.Input
						placeholder="Search {kind === 'guest' ? 'guests by name' : 'properties by title'}…"
						aria-label="Search {kind === 'guest' ? 'guests by name' : 'properties by title'}"
						value={search}
						oninput={(event) => onSearch(event.currentTarget.value)}
					/>
					<Command.List>
						{#if results.isPending}
							<Command.Loading>
								<div class="text-muted-foreground flex items-center gap-2 px-2 py-3 text-sm">
									<Spinner /> Searching…
								</div>
							</Command.Loading>
						{:else if results.isError}
							<p class="text-destructive px-2 py-3 text-sm">{toApiError(results.error).message}</p>
						{:else if options.length === 0}
							<p class="text-muted-foreground px-2 py-3 text-sm">Nothing matches “{debounced}”.</p>
						{:else}
							<Command.Group>
								{#each options as option (option.id)}
									<Command.Item value={option.id} onSelect={() => choose(option.id)}>
										<span class="min-w-0 flex-1 truncate">{option.name}</span>
										<span class="text-caption text-muted-foreground shrink-0 tabular-nums">{option.hint}</span>
									</Command.Item>
								{/each}
							</Command.Group>
						{/if}
					</Command.List>
				</Command.Root>
			</Popover.Content>
		</Popover.Root>
		{#if value !== null}
			<Button variant="ghost" size="icon" aria-label="Clear {label.toLowerCase()}" onclick={() => choose(null)}>
				<XIcon />
			</Button>
		{/if}
	</div>
</div>
