<script lang="ts">
	import { rupees } from '#lib/format.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		value: string | number;
		/** Show a leading + on credits and colour the sign. The sign is always in the text, not colour alone. */
		signed?: boolean;
		whole?: boolean;
		class?: string;
	};

	let { value, signed = false, whole = false, class: className }: Props = $props();

	const amount = $derived(Number(value));
	const text = $derived(signed && amount > 0 ? `+${rupees(value, { whole })}` : rupees(value, { whole }));
</script>

<span
	class={cn(
		'whitespace-nowrap tabular-nums',
		signed && amount > 0 && 'text-success',
		signed && amount < 0 && 'text-destructive',
		className
	)}
>
	{text}
</span>
