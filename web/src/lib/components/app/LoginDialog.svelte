<script lang="ts">
	import BedDoubleIcon from '@lucide/svelte/icons/bed-double';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import WalletMinimalIcon from '@lucide/svelte/icons/wallet-minimal';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import * as Command from '#lib/components/shadcn/command/index.js';
	import { Spinner } from '#lib/components/shadcn/spinner/index.js';
	import { userMessage } from '#lib/api/errors.js';
	import { queries } from '#lib/api/queries.js';
	import { rupees } from '#lib/format.js';
	import { getActor } from '#lib/state/actor.svelte.js';

	// Logging in means choosing one of the guest accounts. One dialog serves every "Log in" button.
	const actor = getActor();
	const queryClient = useQueryClient();

	let search = $state('');
	let debounced = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;
	let picking = $state<'low' | 'active' | null>(null);

	const results = createQuery(() => ({
		...queries.guests.list({ q: debounced.trim(), limit: '8' }),
		enabled: actor.loginOpen
	}));

	function onSearch(value: string) {
		search = value;
		clearTimeout(timer);
		timer = setTimeout(() => (debounced = value), 250);
	}

	function choose(guest: { id: string; name: string }) {
		const switching = actor.signedIn;
		actor.guestId = guest.id;
		actor.loginOpen = false;
		toast.success(switching ? `Switched to ${guest.name}` : `Welcome, ${guest.name.split(' ')[0]}`);
	}

	function logOut() {
		actor.logOut();
		actor.loginOpen = false;
		toast.success('Logged out');
	}

	const quickPicks = {
		low: { query: { sort: 'balance_asc', limit: '1' }, empty: 'No accounts found.' },
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
			toast.error(userMessage(error));
		} finally {
			picking = null;
		}
	}
</script>

<Command.Dialog
	bind:open={actor.loginOpen}
	shouldFilter={false}
	title={actor.signedIn ? 'Switch account' : 'Log in'}
	description="Choose a guest account to continue."
	label="Choose an account"
>
	<div class="flex flex-col gap-1 border-b px-4 pt-4 pb-3">
		<h2 class="text-title">{actor.signedIn ? 'Switch account' : 'Log in'}</h2>
		<p class="text-caption text-muted-foreground">Choose a guest account to continue.</p>
	</div>
	<Command.Input
		placeholder="Search accounts by name…"
		value={search}
		oninput={(event) => onSearch(event.currentTarget.value)}
		aria-label="Search accounts by name"
	/>
	<Command.List class="max-h-[min(24rem,60dvh)]">
		{#if search.trim() === ''}
			<Command.Group heading="Suggested">
				<Command.Item value="quick-low" onSelect={() => quickPick('low')} disabled={picking !== null}>
					{#if picking === 'low'}<Spinner />{:else}<WalletMinimalIcon />{/if}
					<div class="flex flex-col">
						<span>Lowest balance</span>
						<span class="text-caption text-muted-foreground">The account with the smallest wallet</span>
					</div>
				</Command.Item>
				<Command.Item value="quick-active" onSelect={() => quickPick('active')} disabled={picking !== null}>
					{#if picking === 'active'}<Spinner />{:else}<BedDoubleIcon />{/if}
					<div class="flex flex-col">
						<span>Checked in</span>
						<span class="text-caption text-muted-foreground">A guest staying somewhere now</span>
					</div>
				</Command.Item>
			</Command.Group>
			<Command.Separator />
		{/if}
		<Command.Group heading={search.trim() ? 'Matching accounts' : 'Accounts'}>
			{#if results.isPending}
				<Command.Loading>
					<div class="text-muted-foreground flex items-center gap-2 px-2 py-3 text-sm">
						<Spinner /> Searching accounts…
					</div>
				</Command.Loading>
			{:else if results.isError}
				<p class="text-destructive px-2 py-3 text-sm">{userMessage(results.error)}</p>
			{:else if results.data.items.length === 0}
				<p class="text-muted-foreground px-2 py-3 text-sm">No accounts match “{debounced}”.</p>
			{:else}
				{#each results.data.items as guest (guest.id)}
					<Command.Item value={guest.id} onSelect={() => choose(guest)}>
						<span class="min-w-0 flex-1 truncate">{guest.name}</span>
						<span class="text-caption text-muted-foreground tabular-nums">{rupees(guest.wallet_balance)}</span>
					</Command.Item>
				{/each}
			{/if}
		</Command.Group>
		{#if actor.signedIn}
			<Command.Separator />
			<Command.Group>
				<Command.Item value="log-out" onSelect={logOut}>
					<LogOutIcon />
					Log out
				</Command.Item>
			</Command.Group>
		{/if}
	</Command.List>
</Command.Dialog>
