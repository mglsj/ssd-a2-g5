<script lang="ts">
	import BriefcaseBusinessIcon from '@lucide/svelte/icons/briefcase-business';
	import UserIcon from '@lucide/svelte/icons/user';
	import * as ToggleGroup from '#lib/components/shadcn/toggle-group/index.js';
	import { getActor, type Role } from '#lib/state/actor.svelte.js';

	let { class: className }: { class?: string } = $props();

	const actor = getActor();

	// The selected role reads as a solid ink pill. Blue stays reserved for actions.
	// Equal halves when the switcher is full width. min-w-fit stops a half shrinking below its label,
	// which squeezed "Manager" into its padding. The padding repeats the toggle group's own variants,
	// which a plain px-* cannot override.
	const itemClass =
		'text-muted-foreground data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:hover:bg-foreground/90 data-[state=on]:hover:text-background min-w-fit flex-1 gap-1.5 group-data-[spacing=0]/toggle-group:px-3 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:pl-2.5';
</script>

<ToggleGroup.Root
	type="single"
	variant="outline"
	aria-label="Act as"
	bind:value={
		() => actor.role,
		(value) => {
			// A single toggle group clears when the active item is clicked. Keep one role selected.
			if (value) actor.role = value as Role;
		}
	}
	class={className}
>
	<ToggleGroup.Item value="guest" class={itemClass}>
		<UserIcon data-icon="inline-start" />
		Guest
	</ToggleGroup.Item>
	<ToggleGroup.Item value="manager" class={itemClass}>
		<BriefcaseBusinessIcon data-icon="inline-start" />
		Manager
	</ToggleGroup.Item>
</ToggleGroup.Root>
