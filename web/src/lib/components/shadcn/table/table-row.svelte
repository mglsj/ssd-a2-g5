<script lang="ts">
	import { cn, type WithElementRef } from "#lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLTableRowElement>> = $props();
</script>

<tr
	bind:this={ref}
	data-slot="table-row"
	class={cn("hover:bg-accent/60 data-[state=selected]:bg-accent border-b transition-colors has-aria-expanded:bg-accent/60", className)}
	{...restProps}
>
	{@render children?.()}
</tr>
