<script lang="ts">
	import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';
	import * as Alert from '#lib/components/shadcn/alert/index.js';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import { Spinner } from '#lib/components/shadcn/spinner/index.js';
	import { errorInfo, toApiError } from '#lib/api/errors.js';
	import type { Snippet } from 'svelte';

	type Props = {
		error: unknown;
		/** Shows a Retry button. */
		onretry?: () => unknown;
		retrying?: boolean;
		/** Overrides the title picked from the error code. */
		title?: string;
		class?: string;
		/** Follow-up actions next to Retry. */
		children?: Snippet;
	};

	let { error, onretry, retrying = false, title, class: className, children }: Props = $props();

	const apiError = $derived(toApiError(error));
	const info = $derived(errorInfo[apiError.code]);
</script>

<Alert.Root variant="destructive" class={className}>
	<info.icon />
	<Alert.Title>{title ?? info.title}</Alert.Title>
	<Alert.Description>
		<p>{apiError.message}</p>
		{#if onretry || children}
			<div class="mt-2 flex flex-wrap gap-2">
				{#if onretry}
					<Button size="sm" variant="outline" onclick={() => onretry()} disabled={retrying}>
						{#if retrying}
							<Spinner data-icon="inline-start" />
						{:else}
							<RotateCwIcon data-icon="inline-start" />
						{/if}
						Retry
					</Button>
				{/if}
				{@render children?.()}
			</div>
		{/if}
	</Alert.Description>
</Alert.Root>
