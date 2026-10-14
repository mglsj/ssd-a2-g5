<script lang="ts">
	import { cn, type WithElementRef } from "#lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<!-- StaySpot: card titles are level-2 headings so page outlines stay in order. Pass role or aria-level to change it. -->
<div
	bind:this={ref}
	data-slot="card-title"
	role="heading"
	aria-level={2}
	class={cn("text-heading-3 group-data-[size=sm]/card:text-title", className)}
	{...restProps}
>
	{@render children?.()}
</div>
