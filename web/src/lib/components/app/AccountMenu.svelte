<script lang="ts">
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import LogInIcon from '@lucide/svelte/icons/log-in';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import UserRoundIcon from '@lucide/svelte/icons/user-round';
	import UsersRoundIcon from '@lucide/svelte/icons/users-round';
	import WalletIcon from '@lucide/svelte/icons/wallet';
	import { createQuery } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import * as DropdownMenu from '#lib/components/shadcn/dropdown-menu/index.js';
	import Money from '#lib/components/data/Money.svelte';
	import { queries } from '#lib/api/queries.js';
	import { getActor } from '#lib/state/actor.svelte.js';
	import { cn } from '#lib/utils.js';

	/** compact: the phone header, where the name gives way to an icon. */
	let { compact = false, class: className }: { compact?: boolean; class?: string } = $props();

	const actor = getActor();

	const guest = createQuery(() => ({
		...queries.guests.detail(actor.guestId ?? ''),
		enabled: actor.guestId !== null
	}));

	const name = $derived(guest.data?.name ?? (guest.isError ? 'Account' : 'Loading…'));

	function logOut() {
		actor.logOut();
		toast.success('Logged out');
	}
</script>

{#if !actor.signedIn}
	<Button class={className} size={compact ? 'sm' : 'default'} onclick={() => actor.logIn()}>
		<LogInIcon data-icon="inline-start" />
		Log in
	</Button>
{:else}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="outline"
					size={compact ? 'icon' : 'default'}
					class={cn('min-w-0', !compact && 'max-w-52', className)}
					aria-label="Account: {name}"
				>
					<UserRoundIcon data-icon={compact ? undefined : 'inline-start'} />
					{#if !compact}
						<span class="truncate">{name}</span>
						<ChevronDownIcon data-icon="inline-end" class="opacity-50" />
					{/if}
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-60">
			<DropdownMenu.Label class="flex flex-col gap-0.5">
				<span class="truncate">{name}</span>
				{#if guest.data}
					<span class="text-caption text-muted-foreground font-normal">
						Balance <Money value={guest.data.wallet_balance} />
					</span>
				{/if}
			</DropdownMenu.Label>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={() => goto(`/guests/${actor.guestId}/wallet`)}>
				<WalletIcon />
				Wallet
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={() => goto('/bookings')}>
				<CalendarDaysIcon />
				My bookings
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={() => actor.logIn()}>
				<UsersRoundIcon />
				Switch account
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={logOut}>
				<LogOutIcon />
				Log out
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/if}
