<script lang="ts">
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import * as Dialog from '#lib/components/shadcn/dialog/index.js';
	import * as InputGroup from '#lib/components/shadcn/input-group/index.js';
	import { Label } from '#lib/components/shadcn/label/index.js';
	import { Spinner } from '#lib/components/shadcn/spinner/index.js';
	import Money from '#lib/components/data/Money.svelte';
	import ErrorState from '#lib/components/states/ErrorState.svelte';
	import { toApiError } from '#lib/api/errors.js';
	import { keys, mutations, type TopUpResult } from '#lib/api/queries.js';
	import { fromPaise, rupees, toPaise } from '#lib/format.js';
	import AuditRow from './AuditRow.svelte';

	type Props = {
		guestId: string;
		guestName?: string;
		/** Prefills the amount, for example the shortfall of a failed booking. */
		initialAmount?: string;
		onclose: () => void;
		ondone?: (result: TopUpResult) => void;
	};

	let { guestId, guestName, initialAmount = '', onclose, ondone }: Props = $props();

	const queryClient = useQueryClient();
	// The form mounts each time the dialog opens, so it starts from the suggested amount.
	// svelte-ignore state_referenced_locally
	let amount = $state(initialAmount);
	let touched = $state(false);

	const AMOUNT = /^\d{1,8}(\.\d{1,2})?$/;
	const quick = [500, 1000, 5000];

	const localError = $derived.by(() => {
		const value = amount.trim();
		if (value === '') return 'Enter an amount';
		if (!AMOUNT.test(value)) return 'Use rupees with at most two decimals, below 10 crore';
		if (toPaise(value) <= 0) return 'The amount must be more than zero';
		return undefined;
	});

	const topUp = createMutation(() => ({
		mutationFn: (value: string) => mutations.topUp(guestId, value),
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: keys.guests.all });
			ondone?.(result);
		}
	}));

	// A rejected amount (too large for the wallet, or malformed) shows on the field.
	const serverFieldError = $derived.by(() => {
		if (!topUp.isError) return undefined;
		const error = toApiError(topUp.error);
		if (error.code === 'INVALID_INPUT') return error.message;
		if (error.code === 'BAD_REQUEST') return error.issues.amount ?? error.message;
		return undefined;
	});
	const fieldError = $derived(touched ? (localError ?? serverFieldError) : undefined);

	function add(rupeesToAdd: number) {
		const base = AMOUNT.test(amount.trim()) ? toPaise(amount.trim()) : 0;
		amount = fromPaise(base + rupeesToAdd * 100);
		topUp.reset();
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		touched = true;
		if (localError) return;
		topUp.mutate(amount.trim());
	}
</script>

{#if topUp.data}
	{@const result = topUp.data}
	<Dialog.Header>
		<Dialog.Title class="flex items-center gap-2">
			<CircleCheckIcon class="text-success size-5" aria-hidden="true" />
			Wallet topped up
		</Dialog.Title>
		<Dialog.Description>
			sp_top_up_wallet added <Money value={result.audit_log.amount_changed} /> to {guestName ?? 'the wallet'}.
		</Dialog.Description>
	</Dialog.Header>
	<div class="flex flex-col gap-4">
		<p class="text-body-md flex flex-wrap items-center gap-2">
			<Money value={result.balance_before} class="text-muted-foreground" />
			<ArrowRightIcon class="size-4" aria-label="to" />
			<Money value={result.balance_after} class="font-semibold" />
		</p>
		<AuditRow entry={result.audit_log} />
	</div>
	<Dialog.Footer>
		<Button onclick={onclose}>Done</Button>
	</Dialog.Footer>
{:else}
	<form class="contents" onsubmit={submit} novalidate>
		<Dialog.Header>
			<Dialog.Title>Top up wallet</Dialog.Title>
			<Dialog.Description>
				{guestName ? `Adds money to ${guestName}'s wallet.` : 'Adds money to the wallet.'} It writes a CREDIT row to the audit log.
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-3">
			<div class="flex flex-col gap-1.5">
				<Label for="top-up-amount">Amount</Label>
				<InputGroup.Root aria-invalid={fieldError ? 'true' : undefined}>
					<InputGroup.Addon><InputGroup.Text>₹</InputGroup.Text></InputGroup.Addon>
					<InputGroup.Input
						id="top-up-amount"
						name="amount"
						inputmode="decimal"
						autocomplete="off"
						placeholder="0.00"
						bind:value={amount}
						oninput={() => topUp.reset()}
						onblur={() => (touched = true)}
						aria-invalid={fieldError ? 'true' : undefined}
						aria-describedby={fieldError ? 'top-up-amount-error' : undefined}
					/>
				</InputGroup.Root>
				{#if fieldError}
					<p id="top-up-amount-error" class="text-caption text-destructive">{fieldError}</p>
				{/if}
			</div>
			<div class="flex flex-wrap gap-2" role="group" aria-label="Add a quick amount">
				{#each quick as value (value)}
					<Button type="button" variant="outline" size="sm" onclick={() => add(value)}>
						+{rupees(value, { whole: true })}
					</Button>
				{/each}
			</div>
			{#if topUp.isError && !serverFieldError}
				<ErrorState error={topUp.error} />
			{/if}
		</div>

		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={onclose}>Cancel</Button>
			<Button type="submit" disabled={topUp.isPending}>
				{#if topUp.isPending}<Spinner data-icon="inline-start" />{/if}
				{localError ? 'Top up' : `Add ${rupees(amount.trim())}`}
			</Button>
		</Dialog.Footer>
	</form>
{/if}
