<script lang="ts">
	import Building2Icon from '@lucide/svelte/icons/building-2';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import ChartLineIcon from '@lucide/svelte/icons/chart-line';
	import HouseIcon from '@lucide/svelte/icons/house';
	import MapIcon from '@lucide/svelte/icons/map';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import StarIcon from '@lucide/svelte/icons/star';
	import SunIcon from '@lucide/svelte/icons/sun';
	import UsersIcon from '@lucide/svelte/icons/users';
	import WalletIcon from '@lucide/svelte/icons/wallet';
	import { createQuery } from '@tanstack/svelte-query';
	import { mode, toggleMode } from 'mode-watcher';
	import { page } from '$app/state';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import * as Sheet from '#lib/components/shadcn/sheet/index.js';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import { queries } from '#lib/api/queries.js';
	import { rupees } from '#lib/format.js';
	import { getActor } from '#lib/state/actor.svelte.js';
	import { cn } from '#lib/utils.js';
	import Money from '../data/Money.svelte';
	import ActorSwitcher from './ActorSwitcher.svelte';
	import GuestPicker from './GuestPicker.svelte';
	import HealthBanner from './HealthBanner.svelte';
	import type { Component, Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const actor = getActor();
	let menuOpen = $state(false);

	const guest = createQuery(() => ({
		...queries.guests.detail(actor.guestId ?? ''),
		enabled: actor.guestId !== null
	}));

	type NavItem = { href: string | null; label: string; icon: Component };

	const nav = $derived.by((): NavItem[] => {
		const shared: NavItem[] = [
			{ href: '/properties', label: 'Properties', icon: HouseIcon },
			{ href: '/map', label: 'Map', icon: MapIcon },
			{ href: '/reviews', label: 'Reviews', icon: StarIcon }
		];
		if (actor.isManager) {
			return [
				...shared,
				{ href: '/bookings', label: 'Bookings', icon: CalendarDaysIcon },
				{ href: '/guests', label: 'Guests', icon: UsersIcon },
				{ href: '/analytics', label: 'Analytics', icon: ChartLineIcon }
			];
		}
		return [
			...shared,
			{ href: '/bookings', label: 'My bookings', icon: CalendarDaysIcon },
			{ href: actor.guestId ? `/guests/${actor.guestId}/wallet` : null, label: 'Wallet', icon: WalletIcon }
		];
	});

	// The longest matching prefix wins, so /guests/x/wallet marks Wallet and not Guests.
	const activeHref = $derived(
		nav
			.map((item) => item.href)
			.filter((href): href is string => href !== null && (page.url.pathname === href || page.url.pathname.startsWith(`${href}/`)))
			.sort((a, b) => b.length - a.length)[0]
	);
</script>

{#snippet navLinks(vertical: boolean)}
	{#each nav as item (item.label)}
		{#if item.href}
			<a
				href={item.href}
				data-slot="nav-link"
				aria-current={item.href === activeHref ? 'page' : undefined}
				onclick={() => (menuOpen = false)}
				class={cn(
					'text-body-sm text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex items-center gap-2 rounded-md outline-none focus-visible:ring-[3px]',
					vertical ? 'hover:bg-accent px-3 py-2.5' : 'relative px-3 py-3',
					item.href === activeHref && 'text-foreground font-medium',
					item.href === activeHref && !vertical && 'after:bg-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full',
					item.href === activeHref && vertical && 'bg-accent'
				)}
			>
				<item.icon class="size-4" aria-hidden="true" />
				{item.label}
			</a>
		{:else}
			<span
				aria-disabled="true"
				title="Pick a guest first"
				class={cn(
					'text-body-sm text-faint flex cursor-not-allowed items-center gap-2',
					vertical ? 'px-3 py-2.5' : 'px-3 py-3'
				)}
			>
				<item.icon class="size-4" aria-hidden="true" />
				{item.label}
			</span>
		{/if}
	{/each}
{/snippet}

{#snippet balance(compact: boolean)}
	{#if actor.guestId}
		{#if guest.data}
			<Button
				href="/guests/{actor.guestId}/wallet"
				variant="outline"
				size={compact ? 'sm' : 'default'}
				aria-label="Wallet balance {rupees(guest.data.wallet_balance)}. Open wallet"
			>
				<WalletIcon data-icon="inline-start" />
				<Money value={guest.data.wallet_balance} whole={compact} />
			</Button>
		{:else if guest.isPending}
			<Skeleton class="h-9 w-28 rounded-md" />
		{/if}
	{/if}
{/snippet}

<a
	href="#main"
	class="bg-card focus:ring-ring/50 sr-only z-50 rounded-md px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-[3px]"
>
	Skip to content
</a>

<header class="bg-card sticky top-0 z-40 border-b">
	<div class="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
		<Sheet.Root bind:open={menuOpen}>
			<Sheet.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="ghost" size="icon" class="md:hidden" aria-label="Open menu">
						<MenuIcon />
					</Button>
				{/snippet}
			</Sheet.Trigger>
			<Sheet.Content side="left" class="w-80 max-w-[85vw] overscroll-contain">
				<Sheet.Header>
					<Sheet.Title>StaySpot</Sheet.Title>
					<Sheet.Description>
						{actor.isManager ? 'Operations manager' : 'Guest'} view
					</Sheet.Description>
				</Sheet.Header>
				<div class="flex flex-col gap-6 px-4 pb-4">
					<div class="flex flex-col gap-2">
						<p class="text-eyebrow text-muted-foreground uppercase">Act as</p>
						<ActorSwitcher class="w-full" />
						<GuestPicker class="w-full" />
					</div>
					<nav aria-label="Main" class="flex flex-col gap-1">
						{@render navLinks(true)}
					</nav>
				</div>
			</Sheet.Content>
		</Sheet.Root>

		<a href="/" data-slot="wordmark" class="text-foreground flex items-center gap-2 font-bold tracking-tight">
			<span class="bg-foreground text-background grid size-8 place-items-center rounded-md">
				<Building2Icon class="size-4" aria-hidden="true" />
			</span>
			<span class="text-title hidden sm:inline">StaySpot</span>
		</a>

		<div class="ml-auto flex min-w-0 items-center gap-2">
			<ActorSwitcher class="hidden md:flex" />
			<GuestPicker class="hidden max-w-52 md:flex" />
			<div class="hidden md:block">{@render balance(false)}</div>
			<div class="md:hidden">{@render balance(true)}</div>
			<Button variant="ghost" size="icon" onclick={toggleMode} aria-label="Toggle dark mode">
				{#if mode.current === 'dark'}<SunIcon />{:else}<MoonIcon />{/if}
			</Button>
		</div>
	</div>

	<nav aria-label="Main" class="mx-auto hidden max-w-6xl items-center gap-1 overflow-x-auto px-3 sm:px-4 md:flex">
		{@render navLinks(false)}
	</nav>
</header>

<HealthBanner />

<main id="main" class="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
	{@render children()}
</main>
