<script lang="ts">
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import * as Empty from '#lib/components/shadcn/empty/index.js';
	import { cn } from '#lib/utils.js';
	import type { Component, Snippet } from 'svelte';

	type Props = {
		title: string;
		description?: string;
		icon?: Component;
		class?: string;
		/** Makes the title a heading, for example 1 when the empty state is the whole page. */
		level?: number;
		/** The next step, usually a button or link. */
		children?: Snippet;
	};

	let { title, description, icon: Icon = InboxIcon, level, class: className, children }: Props = $props();
</script>

<Empty.Root class={cn('bg-muted/60 border border-dashed', className)}>
	<Empty.Header>
		<Empty.Media variant="icon">
			<Icon />
		</Empty.Media>
		<Empty.Title role={level ? 'heading' : undefined} aria-level={level}>{title}</Empty.Title>
		{#if description}
			<Empty.Description>{description}</Empty.Description>
		{/if}
	</Empty.Header>
	{#if children}
		<Empty.Content>
			{@render children()}
		</Empty.Content>
	{/if}
</Empty.Root>
