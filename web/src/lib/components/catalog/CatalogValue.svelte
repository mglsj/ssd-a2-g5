<script lang="ts" module>
	/** "house_rules" -> "House rules", "noise_policy" -> "Noise policy". */
	export function humanize(key: string): string {
		const words = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase();
		return words.charAt(0).toUpperCase() + words.slice(1);
	}

	export function isPlainObject(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}
</script>

<script lang="ts">
	import { Badge } from '#lib/components/shadcn/badge/index.js';
	import Self from './CatalogValue.svelte';

	let { value }: { value: unknown } = $props();

	// A list of short strings reads best as chips, anything longer as a bullet list.
	const asChips = $derived(
		Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length <= 24)
	);
</script>

{#if value === null || value === undefined || value === ''}
	<span class="text-muted-foreground">Not given</span>
{:else if typeof value === 'boolean'}
	{value ? 'Yes' : 'No'}
{:else if typeof value === 'string' || typeof value === 'number'}
	{value}
{:else if Array.isArray(value)}
	{#if value.length === 0}
		<span class="text-muted-foreground">None listed</span>
	{:else if asChips}
		<ul class="flex flex-wrap gap-1.5">
			{#each value as item, i (i)}
				<li><Badge variant="secondary" class="text-caption h-auto font-normal">{item}</Badge></li>
			{/each}
		</ul>
	{:else}
		<ul class="marker:text-faint flex list-disc flex-col gap-1.5 pl-5">
			{#each value as item, i (i)}
				<li><Self value={item} /></li>
			{/each}
		</ul>
	{/if}
{:else if isPlainObject(value)}
	<!-- An object inside a list, such as { rule, description }, reads as "Rule: description". -->
	{#if Object.keys(value).length === 2 && typeof value.description === 'string' && typeof Object.values(value)[0] === 'string'}
		<span><span class="font-medium">{humanize(String(Object.values(value)[0]))}:</span> {value.description}</span>
	{:else}
		<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
			{#each Object.entries(value) as [key, item] (key)}
				<dt class="text-muted-foreground">{humanize(key)}</dt>
				<dd class="min-w-0 break-words"><Self value={item} /></dd>
			{/each}
		</dl>
	{/if}
{:else}
	{String(value)}
{/if}
