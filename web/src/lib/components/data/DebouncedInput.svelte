<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import XIcon from '@lucide/svelte/icons/x';
	import * as InputGroup from '#lib/components/shadcn/input-group/index.js';
	import { Label } from '#lib/components/shadcn/label/index.js';
	import { cn } from '#lib/utils.js';
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = {
		id: string;
		label: string;
		/** The committed value, usually from the URL. */
		value: string;
		onchange: (value: string) => void;
		delay?: number;
		search?: boolean;
		/** Rupee prefix for price fields. */
		prefix?: string;
		error?: string;
		class?: string;
		placeholder?: string;
		inputmode?: HTMLInputAttributes['inputmode'];
	};

	let {
		id,
		label,
		value,
		onchange,
		delay = 250,
		search = false,
		prefix,
		error,
		class: className,
		placeholder,
		inputmode
	}: Props = $props();

	// Follows the committed value, so "Clear filters" or Back resets what is typed.
	let text = $derived(value);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function input(next: string) {
		text = next;
		clearTimeout(timer);
		timer = setTimeout(() => onchange(next.trim()), delay);
	}

	function commit() {
		clearTimeout(timer);
		if (text.trim() !== value) onchange(text.trim());
	}
</script>

<div class={cn('flex flex-col gap-1.5', className)}>
	<Label for={id}>{label}</Label>
	<InputGroup.Root aria-invalid={error ? 'true' : undefined}>
		{#if search}
			<InputGroup.Addon>
				<SearchIcon aria-hidden="true" />
			</InputGroup.Addon>
		{:else if prefix}
			<InputGroup.Addon>
				<InputGroup.Text>{prefix}</InputGroup.Text>
			</InputGroup.Addon>
		{/if}
		<InputGroup.Input
			{id}
			name={id}
			autocomplete="off"
			value={text}
			oninput={(event) => input(event.currentTarget.value)}
			onkeydown={(event) => event.key === 'Enter' && commit()}
			onblur={commit}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? `${id}-error` : undefined}
			{placeholder}
			{inputmode}
		/>
		{#if search && text}
			<InputGroup.Addon align="inline-end">
				<InputGroup.Button size="icon-xs" aria-label="Clear {label.toLowerCase()}" onclick={() => input('')}>
					<XIcon />
				</InputGroup.Button>
			</InputGroup.Addon>
		{/if}
	</InputGroup.Root>
	{#if error}
		<p id="{id}-error" class="text-caption text-destructive">{error}</p>
	{/if}
</div>
