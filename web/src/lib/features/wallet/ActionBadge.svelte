<script lang="ts">
	import ArrowDownLeftIcon from '@lucide/svelte/icons/arrow-down-left';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import { Badge } from '#lib/components/shadcn/badge/index.js';

	// Credit and debit carry an icon and a word, never colour alone.
	let { action }: { action: string } = $props();
</script>

{#if action === 'CREDIT'}
	<Badge variant="success">
		<ArrowDownLeftIcon data-icon="inline-start" aria-hidden="true" />
		Credit
	</Badge>
{:else}
	<Badge variant="outline">
		<ArrowUpRightIcon data-icon="inline-start" aria-hidden="true" />
		Debit
	</Badge>
{/if}
