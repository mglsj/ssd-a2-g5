<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import LogInIcon from '@lucide/svelte/icons/log-in';
	import PenLineIcon from '@lucide/svelte/icons/pen-line';
	import StarIcon from '@lucide/svelte/icons/star';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import * as Alert from '#lib/components/shadcn/alert/index.js';
	import { Badge } from '#lib/components/shadcn/badge/index.js';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import { Label } from '#lib/components/shadcn/label/index.js';
	import { Spinner } from '#lib/components/shadcn/spinner/index.js';
	import { Textarea } from '#lib/components/shadcn/textarea/index.js';
	import { humanize } from '#lib/components/catalog/CatalogValue.svelte';
	import { toApiError, userMessage } from '#lib/api/errors.js';
	import { keys, mutations, queries } from '#lib/api/queries.js';
	import { getActor } from '#lib/state/actor.svelte.js';
	import { cn } from '#lib/utils.js';
	import { MAX_TAGS, REVIEW_TAGS } from './reviewTags.js';

	let { propertyId }: { propertyId: string } = $props();

	const actor = getActor();
	const queryClient = useQueryClient();

	const guestId = $derived(actor.guestId);
	const eligibility = createQuery(() => ({
		...queries.reviews.eligibility(guestId ?? '', propertyId),
		enabled: guestId !== null
	}));

	let open = $state(false);
	let rating = $state(0);
	let text = $state('');
	let tags = $state<string[]>([]);
	let submitted = $state(false);
	let touched = $state(false);

	const MIN_TEXT = 3;
	const problems = $derived({
		rating: rating === 0 ? 'Choose a star rating' : undefined,
		text: text.trim().length < MIN_TEXT ? 'Write a few words about your stay' : undefined,
		tags: tags.length === 0 ? 'Pick at least one tag' : undefined
	});
	const valid = $derived(!problems.rating && !problems.text && !problems.tags);

	const save = createMutation(() => ({
		mutationFn: () =>
			mutations.createReview({
				guest_id: guestId!,
				property_id: propertyId,
				rating,
				review_text: text.trim(),
				location_tags: tags as (typeof REVIEW_TAGS)[number][]
			}),
		onSuccess: () => {
			submitted = true;
			open = false;
			rating = 0;
			text = '';
			tags = [];
			touched = false;
			queryClient.invalidateQueries({ queryKey: keys.reviews.all });
		},
		onError: () => queryClient.invalidateQueries({ queryKey: keys.reviews.eligibility(guestId ?? '', propertyId) })
	}));

	function toggleTag(tag: string) {
		tags = tags.includes(tag) ? tags.filter((t) => t !== tag) : tags.length < MAX_TAGS ? [...tags, tag] : tags;
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		touched = true;
		if (valid) save.mutate();
	}

	// A different guest starts clean.
	$effect(() => {
		void guestId;
		submitted = false;
		open = false;
		save.reset();
	});
</script>

{#if !actor.isManager}
	<div class="flex flex-col gap-3">
		{#if guestId === null}
			<p class="text-body-sm text-muted-foreground">Stayed here? Log in to leave a review.</p>
			<Button type="button" variant="outline" class="w-fit" onclick={() => actor.logIn()}>
				<LogInIcon data-icon="inline-start" />
				Log in to review
			</Button>
		{:else if submitted}
			<Alert.Root aria-live="polite">
				<CheckIcon />
				<Alert.Title>Thanks for your review</Alert.Title>
				<Alert.Description>It now shows under Latest.</Alert.Description>
			</Alert.Root>
		{:else if eligibility.isPending}
			<p class="text-body-sm text-muted-foreground" role="status">Checking your stays…</p>
		{:else if eligibility.isError}
			<p class="text-body-sm text-muted-foreground">{userMessage(eligibility.error)}</p>
		{:else if !eligibility.data.eligible}
			<p class="text-body-sm text-muted-foreground">
				{eligibility.data.reason === 'ALREADY_REVIEWED'
					? 'You have reviewed every stay you completed here.'
					: 'You can review this property after you complete a stay here.'}
			</p>
		{:else if !open}
			<Button type="button" variant="outline" class="w-fit" onclick={() => (open = true)}>
				<PenLineIcon data-icon="inline-start" />
				Write a review
			</Button>
		{:else}
			<form class="flex flex-col gap-4" onsubmit={submit} novalidate>
				<fieldset class="flex flex-col gap-1.5">
					<legend class="text-body-sm mb-1.5 font-medium">Your rating</legend>
					<div class="flex gap-1" role="radiogroup" aria-label="Star rating">
						{#each [1, 2, 3, 4, 5] as star (star)}
							<button
								type="button"
								role="radio"
								aria-checked={rating === star}
								aria-label="{star} {star === 1 ? 'star' : 'stars'}"
								class="focus-visible:ring-ring/50 rounded-sm p-0.5 outline-none focus-visible:ring-[3px]"
								onclick={() => (rating = star)}
							>
								<StarIcon class={cn('size-6', star <= rating ? 'fill-rating text-rating' : 'text-faint')} />
							</button>
						{/each}
					</div>
					{#if touched && problems.rating}<p class="text-caption text-destructive">{problems.rating}</p>{/if}
				</fieldset>

				<div class="flex flex-col gap-1.5">
					<Label for="review-text">Your review</Label>
					<Textarea
						id="review-text"
						bind:value={text}
						maxlength={2000}
						placeholder="What was the stay like?"
						aria-invalid={touched && problems.text ? 'true' : undefined}
					/>
					{#if touched && problems.text}<p class="text-caption text-destructive">{problems.text}</p>{/if}
				</div>

				<fieldset class="flex flex-col gap-1.5">
					<legend class="text-body-sm mb-1.5 font-medium">
						What is nearby <span class="text-muted-foreground font-normal">(up to {MAX_TAGS})</span>
					</legend>
					<ul class="flex flex-wrap gap-1.5">
						{#each REVIEW_TAGS as tag (tag)}
							{@const on = tags.includes(tag)}
							<li>
								<button
									type="button"
									aria-pressed={on}
									disabled={!on && tags.length >= MAX_TAGS}
									onclick={() => toggleTag(tag)}
									class="focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-[3px] disabled:opacity-50"
								>
									<Badge variant={on ? 'default' : 'outline'} class="font-normal">{humanize(tag)}</Badge>
								</button>
							</li>
						{/each}
					</ul>
					{#if touched && problems.tags}<p class="text-caption text-destructive">{problems.tags}</p>{/if}
				</fieldset>

				{#if save.isError}
					<Alert.Root variant="destructive" aria-live="assertive">
						<Alert.Title>Could not save your review</Alert.Title>
						<Alert.Description>{userMessage(toApiError(save.error))}</Alert.Description>
					</Alert.Root>
				{/if}

				<div class="flex gap-2">
					<Button type="submit" disabled={save.isPending}>
						{#if save.isPending}<Spinner data-icon="inline-start" />{/if}
						Post review
					</Button>
					<Button type="button" variant="ghost" onclick={() => (open = false)} disabled={save.isPending}>Cancel</Button>
				</div>
			</form>
		{/if}
	</div>
{/if}
