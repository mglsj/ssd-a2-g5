<script lang="ts">
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import LogInIcon from '@lucide/svelte/icons/log-in';
	import WalletIcon from '@lucide/svelte/icons/wallet';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import * as Alert from '#lib/components/shadcn/alert/index.js';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import * as Card from '#lib/components/shadcn/card/index.js';
	import * as InputGroup from '#lib/components/shadcn/input-group/index.js';
	import { Label } from '#lib/components/shadcn/label/index.js';
	import { Separator } from '#lib/components/shadcn/separator/index.js';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import { Spinner } from '#lib/components/shadcn/spinner/index.js';
	import Money from '#lib/components/data/Money.svelte';
	import ErrorState from '#lib/components/states/ErrorState.svelte';
	import TopUpDialog from '#lib/features/wallet/TopUpDialog.svelte';
	import { toApiError } from '#lib/api/errors.js';
	import { keys, mutations, queries, type PropertyDetail } from '#lib/api/queries.js';
	import { fromPaise, rupees, toPaise } from '#lib/format.js';
	import BookingResult from './BookingResult.svelte';

	type Props = {
		property: PropertyDetail;
		/** The logged-in guest, or null for a visitor who has not logged in. */
		guestId: string | null;
		/** Opens the login dialog. */
		onlogin: () => void;
	};

	let { property, guestId, onlogin }: Props = $props();

	const queryClient = useQueryClient();
	const MIN = 1;
	const MAX = 365;

	let nights = $state(1);
	let nightsText = $state('1');
	let topUpOpen = $state(false);

	const guest = createQuery(() => ({ ...queries.guests.detail(guestId ?? ''), enabled: guestId !== null }));

	const nightsError = $derived.by(() => {
		const value = Number(nightsText);
		if (!Number.isInteger(value) || value < MIN || value > MAX) return `Nights must be a whole number from ${MIN} to ${MAX}`;
		return undefined;
	});

	// Display only. The procedure computes the real charge from base_price * nights.
	const costPaise = $derived(toPaise(property.base_price) * nights);
	const cost = $derived(fromPaise(costPaise));

	const book = createMutation(() => ({
		mutationFn: () => mutations.book({ guest_id: guestId!, property_id: property.id, nights }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: keys.guests.all });
			queryClient.invalidateQueries({ queryKey: keys.bookings.all });
		},
		onError: (error) => {
			// Re-read the wallet to show that a failed booking charged nothing.
			if (toApiError(error).code === 'INSUFFICIENT_BALANCE' && guestId) {
				queryClient.invalidateQueries({ queryKey: keys.guests.detail(guestId) });
			}
		}
	}));

	const failure = $derived(book.isError ? toApiError(book.error) : null);
	const shortfall = $derived.by(() => {
		if (failure?.code !== 'INSUFFICIENT_BALANCE') return null;
		const total = String(failure.detail.total_cost ?? cost);
		const balance = String(failure.detail.balance ?? guest.data?.wallet_balance ?? '0');
		const gap = toPaise(total) - toPaise(balance);
		return gap > 0 ? fromPaise(gap) : null;
	});

	function setNights(value: number) {
		const next = Math.min(MAX, Math.max(MIN, Math.round(value)));
		nights = next;
		nightsText = String(next);
		book.reset();
	}

	function onNightsInput(text: string) {
		nightsText = text;
		const value = Number(text);
		if (Number.isInteger(value) && value >= MIN && value <= MAX) nights = value;
		book.reset();
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (nightsError || guestId === null) return;
		book.mutate();
	}
</script>

{#if book.data}
	<BookingResult result={book.data} onreset={() => book.reset()} />
{:else}
	<Card.Root elevated>
		<Card.Header>
			<Card.Title>Book this stay</Card.Title>
			<Card.Description>
				<Money value={property.base_price} class="text-foreground font-medium" /> per night
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<form class="flex flex-col gap-5" onsubmit={submit} novalidate>
				<div class="flex flex-col gap-1.5">
					<Label for="nights">Nights</Label>
					<InputGroup.Root class="w-40" aria-invalid={nightsError ? 'true' : undefined}>
						<InputGroup.Addon>
							<InputGroup.Button size="icon-xs" aria-label="One night fewer" onclick={() => setNights(nights - 1)} disabled={nights <= MIN}>
								<MinusIcon />
							</InputGroup.Button>
						</InputGroup.Addon>
						<InputGroup.Input
							id="nights"
							name="nights"
							autocomplete="off"
							inputmode="numeric"
							class="text-center tabular-nums"
							value={nightsText}
							oninput={(event) => onNightsInput(event.currentTarget.value)}
							onblur={() => !nightsError && setNights(nights)}
							aria-invalid={nightsError ? 'true' : undefined}
							aria-describedby={nightsError ? 'nights-error' : undefined}
						/>
						<InputGroup.Addon align="inline-end">
							<InputGroup.Button size="icon-xs" aria-label="One night more" onclick={() => setNights(nights + 1)} disabled={nights >= MAX}>
								<PlusIcon />
							</InputGroup.Button>
						</InputGroup.Addon>
					</InputGroup.Root>
					{#if nightsError}
						<p id="nights-error" class="text-caption text-destructive">{nightsError}</p>
					{/if}
				</div>

				<dl class="text-body-sm grid grid-cols-[1fr_auto] gap-x-4 gap-y-2">
					<dt class="text-muted-foreground">
						{rupees(property.base_price)} × {nights} {nights === 1 ? 'night' : 'nights'}
					</dt>
					<dd class="text-right"><Money value={cost} /></dd>
					<dt class="font-medium">Total</dt>
					<dd class="text-right font-semibold"><Money value={cost} /></dd>
					{#if guestId !== null}
						<div class="col-span-2"><Separator /></div>
						<dt class="text-muted-foreground flex items-center gap-1.5">
							<WalletIcon class="size-3.5" aria-hidden="true" />
							{guest.data ? `${guest.data.name}'s wallet` : 'Wallet'}
						</dt>
						<dd class="text-right">
							{#if guest.data}
								<Money value={guest.data.wallet_balance} />
							{:else if guest.isPending}
								<Skeleton class="ml-auto h-4 w-20" />
							{:else}
								<span class="text-muted-foreground">Unavailable</span>
							{/if}
						</dd>
					{/if}
				</dl>

				{#if guestId === null}
					<Button type="button" size="lg" class="w-full" onclick={onlogin}>
						<LogInIcon data-icon="inline-start" />
						Log in to continue
					</Button>
				{:else}
					<Button type="submit" size="lg" class="w-full" disabled={!!nightsError || book.isPending}>
						{#if book.isPending}<Spinner data-icon="inline-start" />{/if}
						Book for {rupees(cost, { whole: costPaise % 100 === 0 })}
					</Button>
				{/if}
			</form>
		</Card.Content>

		{#if failure}
			<Card.Footer class="flex flex-col items-stretch gap-3">
				{#if failure.code === 'INSUFFICIENT_BALANCE'}
					<Alert.Root variant="destructive" aria-live="assertive">
						<WalletIcon />
						<Alert.Title>Not enough in the wallet</Alert.Title>
						<Alert.Description>
							<p>
								This stay costs <Money value={String(failure.detail.total_cost ?? cost)} class="font-medium" />, which is
								more than the wallet holds.
							</p>
							<p>
								Nothing was charged. The wallet still holds
								{#if guest.isFetching}
									<Spinner class="inline size-3" aria-label="Checking the balance" />
								{:else if guest.data}
									<Money value={guest.data.wallet_balance} class="font-medium" />
								{/if}.
							</p>
						</Alert.Description>
					</Alert.Root>
					{#if shortfall}
						<Button variant="outline" onclick={() => (topUpOpen = true)}>
							<PlusIcon data-icon="inline-start" />
							Top up {rupees(shortfall)}
						</Button>
					{/if}
				{:else}
					<ErrorState error={book.error} onretry={() => book.mutate()} retrying={book.isPending} />
				{/if}
			</Card.Footer>
		{/if}
	</Card.Root>

	{#if guestId}
		<TopUpDialog
			bind:open={topUpOpen}
			{guestId}
			guestName={guest.data?.name}
			initialAmount={shortfall ?? ''}
			ondone={() => book.reset()}
		/>
	{/if}
{/if}
