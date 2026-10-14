<script lang="ts">
	import * as Dialog from '#lib/components/shadcn/dialog/index.js';
	import type { TopUpResult } from '#lib/api/queries.js';
	import TopUpForm from './TopUpForm.svelte';

	type Props = {
		open: boolean;
		guestId: string;
		guestName?: string;
		initialAmount?: string;
		ondone?: (result: TopUpResult) => void;
	};

	let { open = $bindable(false), guestId, guestName, initialAmount, ondone }: Props = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="overscroll-contain sm:max-w-md">
		<!-- Mounted per opening, so the form always starts fresh. -->
		<TopUpForm {guestId} {guestName} {initialAmount} {ondone} onclose={() => (open = false)} />
	</Dialog.Content>
</Dialog.Root>
