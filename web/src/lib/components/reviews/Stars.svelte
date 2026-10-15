<script lang="ts">
	import StarIcon from '@lucide/svelte/icons/star';
	import { cn } from '#lib/utils.js';

	let { rating, class: className }: { rating: number; class?: string } = $props();
</script>

<!-- The number is the label. The stars only decorate it. -->
<span class={cn('inline-flex items-center gap-1.5', className)}>
	<span class="flex" aria-hidden="true">
		{#each [1, 2, 3, 4, 5] as star (star)}
			<StarIcon class={cn('size-3.5', star <= Math.round(rating) ? 'fill-rating text-rating' : 'text-faint')} />
		{/each}
	</span>
	<span class="tabular-nums">{rating.toFixed(1)}<span class="sr-only"> out of 5</span></span>
</span>
