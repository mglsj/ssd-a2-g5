<script lang="ts">
	import * as ToggleGroup from '#lib/components/shadcn/toggle-group/index.js';
	import { statusLabel, type BookingStatus } from '#lib/format.js';

	type Props = {
		value: BookingStatus | null;
		onchange: (status: BookingStatus | null) => void;
	};

	let { value, onchange }: Props = $props();

	const options = ['all', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED'] as const;
</script>

<div class="flex min-w-0 flex-col gap-1.5">
	<span id="status-filter-label" class="text-sm font-medium select-none">Status</span>
	<ToggleGroup.Root
		type="single"
		variant="outline"
		aria-labelledby="status-filter-label"
		bind:value={
			() => value ?? 'all',
			(next) => {
				if (next) onchange(next === 'all' ? null : (next as BookingStatus));
			}
		}
		class="max-w-full overflow-x-auto"
	>
		{#each options as option (option)}
			<ToggleGroup.Item
				value={option}
				class="data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:hover:bg-foreground/90 data-[state=on]:hover:text-background text-muted-foreground px-3"
			>
				{option === 'all' ? 'All' : statusLabel[option]}
			</ToggleGroup.Item>
		{/each}
	</ToggleGroup.Root>
</div>
