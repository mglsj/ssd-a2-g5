<script lang="ts">
	import BedDoubleIcon from '@lucide/svelte/icons/bed-double';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import UserRoundIcon from '@lucide/svelte/icons/user-round';
	import WalletMinimalIcon from '@lucide/svelte/icons/wallet-minimal';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import * as Command from '#lib/components/shadcn/command/index.js';
	import * as Popover from '#lib/components/shadcn/popover/index.js';
	import { Spinner } from '#lib/components/shadcn/spinner/index.js';
	import { toApiError } from '#lib/api/errors.js';
	import { queries } from '#lib/api/queries.js';
	import { rupees } from '#lib/format.js';
	import { getActor } from '#lib/state/actor.svelte.js';
	import { cn } from '#lib/utils.js';

	let { class: className }: { class?: string } = $props();

	const actor = getActor();
	const queryClient = useQueryClient();

	let open = $state(false);
	let search = $state('');
	let debounced = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;
	let picking = $state<'low' | 'active' | null>(null);

	const current = createQuery(() => ({
		...queries.guests.detail(actor.guestId ?? ''),
		enabled: actor.guestId !== null
	}));

	const results = createQuery(() => ({
		...queries.guests.list({ q: debounced.trim(), limit: '8' }),
		enabled: open,
	}));

	function onSearch(value: string) {
		search = value;
		clearTimeout(timer);
		timer = setTimeout(() => (debounced = value), 250);
	}

	function choose(guest: { id: string; name: string }) {
		actor.guestId = guest.id;
		open = false;
		toast.success(`Acting as ${guest.name}`);
	}

	const quickPicks = {
		low: { query: { sort: 'balance_asc', limit: '1' }, empty: 'No guests found.' },
		active: { query: { has_active_stay: 'true', limit: '1' }, empty: 'No guest is checked in right now.' }
	} as const;

	async function quickPick(kind: keyof typeof quickPicks) {
		picking = kind;
		try {
			const page = await queryClient.fetchQuery(queries.guests.list(quickPicks[kind].query));
			const guest = page.items[0];
			if (guest) choose(guest);
			else toast.info(quickPicks[kind].empty);
		} catch (error) {
			toast.error(toApiError(error).message);
		} finally {
			picking = null;
		}
	}

	const label = $derived(
		actor.guestId === null ? 'Pick a guest' : (current.data?.name ?? (current.isError ? 'Guest unavailable' : 'Loading…'))
	);
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="outline"
				role="combobox"
				aria-expanded={open}
				aria-label="Active guest: {label}. Change guest"
				class={cn('min-w-0 justify-between', className)}
			>
				<UserRoundIcon data-icon="inline-start" />
				<span class="flex-1 truncate text-left">{label}</span>
				<ChevronsUpDownIcon data-icon="inline-end" class="opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-80 p-0" align="end">
		<Command.Root shouldFilter={false} label="Pick a guest">
			<Command.Input
				placeholder="Search guests by name…"
				value={search}
				oninput={(event) => onSearch(event.currentTarget.value)}
				aria-label="Search guests by name"
			/>
			<Command.List>
				{#if search.trim() === ''}
					<Command.Group heading="Quick picks">
						<Command.Item value="quick-low" onSelect={() => quickPick('low')} disabled={picking !== null}>
							{#if picking === 'low'}<Spinner />{:else}<WalletMinimalIcon />{/if}
							<div class="flex flex-col">
								<span>Low balance guest</span>
								<span class="text-caption text-muted-foreground">Their next booking fails</span>
							</div>
						</Command.Item>
						<Command.Item value="quick-active" onSelect={() => quickPick('active')} disabled={picking !== null}>
							{#if picking === 'active'}<Spinner />{:else}<BedDoubleIcon />{/if}
							<div class="flex flex-col">
								<span>Checked-in guest</span>
								<span class="text-caption text-muted-foreground">A second check-in is blocked</span>
							</div>
						</Command.Item>
					</Command.Group>
					<Command.Separator />
				{/if}
				<Command.Group heading={search.trim() ? 'Matching guests' : 'Guests'}>
					{#if results.isPending}
						<Command.Loading>
							<div class="text-muted-foreground flex items-center gap-2 px-2 py-3 text-sm">
								<Spinner /> Searching guests…
							</div>
						</Command.Loading>
					{:else if results.isError}
						<p class="text-destructive px-2 py-3 text-sm">{toApiError(results.error).message}</p>
					{:else if results.data.items.length === 0}
						<p class="text-muted-foreground px-2 py-3 text-sm">No guests match “{debounced}”.</p>
					{:else}
						{#each results.data.items as guest (guest.id)}
							<Command.Item value={guest.id} onSelect={() => choose(guest)}>
								<span class="min-w-0 flex-1 truncate">{guest.name}</span>
								<span class="text-caption text-muted-foreground tabular-nums">{rupees(guest.wallet_balance)}</span>
							</Command.Item>
						{/each}
					{/if}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
