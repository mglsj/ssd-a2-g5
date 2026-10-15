<script lang="ts">
	import LockKeyholeIcon from '@lucide/svelte/icons/lock-keyhole';
	import LogInIcon from '@lucide/svelte/icons/log-in';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import EmptyState from '#lib/components/states/EmptyState.svelte';
	import { getActor } from '#lib/state/actor.svelte.js';

	type Props = {
		/** login: a guest page seen before logging in. manager: a page only managers can open. */
		kind: 'login' | 'manager';
		/** What the page holds, such as "your bookings". */
		what?: string;
	};

	let { kind, what = 'this page' }: Props = $props();

	const actor = getActor();
</script>

{#if kind === 'login'}
	<EmptyState icon={LogInIcon} level={1} title="Log in to see {what}" description="Choose your account to continue.">
		<Button onclick={() => actor.logIn()}>
			<LogInIcon data-icon="inline-start" />
			Log in
		</Button>
	</EmptyState>
{:else}
	<EmptyState
		icon={LockKeyholeIcon}
		level={1}
		title="For managers only"
		description="Switch to Manager in the header to open {what}."
	>
		<Button variant="outline" href="/properties">Browse properties</Button>
	</EmptyState>
{/if}
