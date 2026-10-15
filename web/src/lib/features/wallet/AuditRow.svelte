<script lang="ts">
	import ReceiptIcon from '@lucide/svelte/icons/receipt';
	import Money from '#lib/components/data/Money.svelte';
	import ActionBadge from './ActionBadge.svelte';
	import type { AuditEntry } from '#lib/api/queries.js';
	import { dateTime } from '#lib/format.js';

	/** One new wallet transaction, shown as a receipt after a top-up or booking. */
	let { entry }: { entry: AuditEntry } = $props();

	const signed = $derived(entry.action_type === 'CREDIT' ? entry.amount_changed : `-${entry.amount_changed}`);
</script>

<figure class="@container flex flex-col gap-2">
	<figcaption class="text-eyebrow text-muted-foreground flex items-center gap-1.5 uppercase">
		<ReceiptIcon class="size-3.5" aria-hidden="true" />
		Wallet transaction
	</figcaption>
	<dl class="bg-accent/60 ring-foreground/15 grid grid-cols-2 gap-x-4 gap-y-3 rounded-md p-4 ring-1 @lg:grid-cols-4">
		<div class="flex flex-col gap-1">
			<dt class="text-eyebrow text-muted-foreground uppercase">Type</dt>
			<dd><ActionBadge action={entry.action_type} /></dd>
		</div>
		<div class="flex flex-col gap-1">
			<dt class="text-eyebrow text-muted-foreground uppercase">Amount</dt>
			<dd class="text-body-sm font-medium"><Money value={signed} signed /></dd>
		</div>
		<div class="flex flex-col gap-1">
			<dt class="text-eyebrow text-muted-foreground uppercase">Balance after</dt>
			<dd class="text-body-sm font-medium"><Money value={entry.balance_after} /></dd>
		</div>
		<div class="flex flex-col gap-1">
			<dt class="text-eyebrow text-muted-foreground uppercase">Time</dt>
			<dd class="text-body-sm"><time datetime={entry.timestamp}>{dateTime(entry.timestamp)}</time></dd>
		</div>
	</dl>
</figure>
