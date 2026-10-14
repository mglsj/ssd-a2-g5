<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import { statusLabel, type BookingStatus } from '#lib/format.js';
	import { cn } from '#lib/utils.js';

	let { status }: { status: BookingStatus } = $props();

	const steps: { status: BookingStatus; hint: string }[] = [
		{ status: 'CONFIRMED', hint: 'Booked and paid from the wallet' },
		{ status: 'CHECKED_IN', hint: 'The guest is staying now' },
		{ status: 'COMPLETED', hint: 'The stay is over and counts as revenue' }
	];

	const current = $derived(steps.findIndex((step) => step.status === status));
</script>

<ol class="flex flex-col gap-0" aria-label="Status timeline">
	{#each steps as step, i (step.status)}
		{@const state = i < current ? 'done' : i === current ? 'current' : 'upcoming'}
		<li class="relative flex gap-3 pb-6 last:pb-0" aria-current={state === 'current' ? 'step' : undefined}>
			{#if i < steps.length - 1}
				<span
					class={cn('absolute top-7 bottom-1 left-3.5 w-px -translate-x-1/2', i < current ? 'bg-foreground' : 'bg-border')}
					aria-hidden="true"
				></span>
			{/if}
			<span
				class={cn(
					'text-eyebrow relative z-10 grid size-7 shrink-0 place-items-center rounded-full border',
					state === 'done' && 'bg-foreground text-background border-foreground',
					state === 'current' && 'bg-card border-foreground text-foreground border-2',
					state === 'upcoming' && 'bg-card text-faint'
				)}
				aria-hidden="true"
			>
				{#if state === 'done'}<CheckIcon class="size-3.5" />{:else}{i + 1}{/if}
			</span>
			<div class="flex flex-col pt-0.5">
				<span class={cn('text-body-sm font-medium', state === 'upcoming' && 'text-muted-foreground')}>
					{statusLabel[step.status]}
					<span class="sr-only">({state === 'done' ? 'done' : state === 'current' ? 'current status' : 'not yet'})</span>
				</span>
				<span class="text-caption text-muted-foreground">{step.hint}</span>
			</div>
		</li>
	{/each}
</ol>
