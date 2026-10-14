<script lang="ts">
	import { toggleMode } from 'mode-watcher';
	import { toast } from 'svelte-sonner';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Badge } from '#lib/components/shadcn/badge/index.js';
	import { Button } from '#lib/components/shadcn/button/index.js';
	import * as Card from '#lib/components/shadcn/card/index.js';
	import * as Dialog from '#lib/components/shadcn/dialog/index.js';
	import { Input } from '#lib/components/shadcn/input/index.js';
	import { Label } from '#lib/components/shadcn/label/index.js';
	import * as Select from '#lib/components/shadcn/select/index.js';
	import { Separator } from '#lib/components/shadcn/separator/index.js';
	import { Skeleton } from '#lib/components/shadcn/skeleton/index.js';
	import * as Table from '#lib/components/shadcn/table/index.js';
	import * as Tabs from '#lib/components/shadcn/tabs/index.js';

	const typeScale = [
		['text-display-1', 'Display 1', '64 / 700'],
		['text-display-2', 'Display 2', '54 / 700'],
		['text-heading-1', 'Heading 1', '40 / 700'],
		['text-heading-2', 'Heading 2', '26 / 700'],
		['text-heading-3', 'Heading 3', '22 / 700'],
		['text-title', 'Title', '20 / 600'],
		['text-body-md', 'Body', '16 / 400'],
		['text-body-sm', 'Body small', '15 / 400'],
		['text-caption', 'Caption', '14 / 400'],
		['text-eyebrow', 'Eyebrow', '12 / 600']
	] as const;

	const surfaces = [
		['bg-background', 'Canvas', '--background'],
		['bg-card', 'Surface', '--card'],
		['bg-accent', 'Hover', '--accent'],
		['bg-primary', 'Notion blue', '--primary'],
		['bg-primary-active', 'Pressed blue', '--primary-active'],
		['bg-night', 'Night', '--night'],
		['bg-foreground', 'Ink', '--foreground'],
		['bg-muted-foreground', 'Stone', '--muted-foreground']
	] as const;

	const charts = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'] as const;

	const stickers = [
		'bg-sticker-sky',
		'bg-sticker-purple',
		'bg-sticker-pink',
		'bg-sticker-orange',
		'bg-sticker-teal',
		'bg-sticker-green',
		'bg-sticker-brown'
	] as const;

	const bookings = [
		{ guest: 'Ria Dasgupta', property: 'Bloom Hotel, DLF Cyber City', nights: 1, total: '₹4,914.00', status: 'CHECKED_IN' },
		{ guest: 'Yuvraj Manne', property: 'Serviced Apartment in Kukatpally', nights: 12, total: '₹1,52,992.32', status: 'CONFIRMED' },
		{ guest: 'Aachal Bhalla', property: 'Lakeview Flat in DLF Cyber City', nights: 3, total: '₹7,108.17', status: 'COMPLETED' }
	];

	const statusBadge = {
		CONFIRMED: 'default',
		CHECKED_IN: 'secondary',
		COMPLETED: 'success'
	} as const;

	const sorts = [
		{ value: 'name', label: 'Name' },
		{ value: 'balance_desc', label: 'Highest balance' },
		{ value: 'balance_asc', label: 'Lowest balance' }
	];

	let sort = $state('name');
	const sortLabel = $derived(sorts.find((option) => option.value === sort)?.label ?? 'Sort by');
</script>

<svelte:head>
	<title>Design system · StaySpot</title>
</svelte:head>

<section class="bg-night text-night-foreground">
	<div class="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-20">
		<Badge class="w-fit">StaySpot design system</Badge>
		<h1 class="text-display-1 max-w-3xl">Find your stay in Hyderabad.</h1>
		<p class="text-title max-w-2xl font-normal opacity-80">
			A warm paper canvas, near-black Inter type and one confident blue, from DESIGN.md.
		</p>
		<div class="flex flex-wrap gap-3">
			<Button size="lg">
				Book a stay
				<ArrowRightIcon data-icon="inline-end" />
			</Button>
			<Button size="lg" variant="secondary">Browse properties</Button>
		</div>
	</div>
</section>

<main class="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-16">
	<div class="flex items-center justify-between gap-4">
		<h2>Foundations</h2>
		<Button variant="outline" onclick={toggleMode}>
			<MoonIcon data-icon="inline-start" />
			Toggle dark mode
		</Button>
	</div>

	<section class="grid gap-6 md:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>Type scale</Card.Title>
				<Card.Description>Inter with the tracking from DESIGN.md applied per step.</Card.Description>
			</Card.Header>
			<Card.Content class="gap-4">
				{#each typeScale.slice(2) as [cls, name, spec] (cls)}
					<div class="flex items-baseline justify-between gap-4">
						<span class="{cls} truncate">{name}</span>
						<span class="text-caption text-muted-foreground shrink-0">{spec}</span>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>

		<div class="flex flex-col gap-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>Colour</Card.Title>
					<Card.Description>Blue paints actions only. Everything else stays warm grey.</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="grid grid-cols-4 gap-3">
						{#each surfaces as [cls, name, token] (token)}
							<div class="flex flex-col gap-1.5">
								<div class="{cls} ring-border h-12 rounded-md ring-1"></div>
								<span class="text-caption">{name}</span>
								<code class="text-eyebrow text-muted-foreground">{token}</code>
							</div>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Charts and stickers</Card.Title>
					<Card.Description>
						Chart series use this fixed order. Stickers are decoration and never paint an action.
					</Card.Description>
				</Card.Header>
				<Card.Content class="gap-4">
					<div class="flex gap-2">
						{#each charts as cls, i (cls)}
							<div class="flex flex-1 flex-col gap-1.5">
								<div class="{cls} h-8 rounded-xs"></div>
								<span class="text-eyebrow text-muted-foreground">Series {i + 1}</span>
							</div>
						{/each}
					</div>
					<div class="flex gap-2">
						{#each stickers as cls (cls)}
							<div class="{cls} size-6 rounded-full"></div>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	</section>

	<section class="flex flex-col gap-6">
		<h2>Components</h2>

		<div class="grid gap-6 lg:grid-cols-3">
			<Card.Root>
				<Card.Header>
					<Card.Title>Buttons</Card.Title>
					<Card.Description>Pills for calls to action, 8px corners for utilities.</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="flex flex-wrap gap-3">
						<Button>Primary</Button>
						<Button variant="secondary">Secondary</Button>
						<Button variant="outline">Utility</Button>
						<Button variant="ghost">Ghost</Button>
						<Button variant="link">Link</Button>
						<Button variant="destructive">Cancel</Button>
						<Button size="icon" aria-label="Add">
							<PlusIcon />
						</Button>
						<Button disabled>Disabled</Button>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Badges</Card.Title>
					<Card.Description>Eyebrow type in a pill. Status also carries a label, never colour alone.</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="flex flex-wrap gap-2">
						<Badge>New listing</Badge>
						<Badge variant="secondary">Checked in</Badge>
						<Badge variant="success">Completed</Badge>
						<Badge variant="outline">Outline</Badge>
						<Badge variant="destructive">Insufficient balance</Badge>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root elevated>
				<Card.Header>
					<Card.Title>Elevated card</Card.Title>
					<Card.Description>The soft layered shadow, for panels that float above the canvas.</Card.Description>
				</Card.Header>
				<Card.Content>
					<p class="text-body-sm text-ink-secondary">
						Most cards stay flat with a hairline. Use <code>elevated</code> sparingly.
					</p>
				</Card.Content>
				<Card.Footer class="gap-2">
					<Dialog.Root>
						<Dialog.Trigger>
							{#snippet child({ props })}
								<Button {...props}>Open dialog</Button>
							{/snippet}
						</Dialog.Trigger>
						<Dialog.Content>
							<Dialog.Header>
								<Dialog.Title>Confirm booking</Dialog.Title>
								<Dialog.Description>3 nights at Lakeview Flat. ₹7,108.17 leaves your wallet.</Dialog.Description>
							</Dialog.Header>
							<Dialog.Footer>
								<Dialog.Close>
									{#snippet child({ props })}
										<Button variant="outline" {...props}>Back</Button>
									{/snippet}
								</Dialog.Close>
								<Button>Book</Button>
							</Dialog.Footer>
						</Dialog.Content>
					</Dialog.Root>
					<Button variant="outline" onclick={() => toast.success('Booking confirmed', { description: 'Audit log row written by the trigger.' })}>
						Show toast
					</Button>
				</Card.Footer>
			</Card.Root>
		</div>

		<div class="grid gap-6 lg:grid-cols-3">
			<Card.Root>
				<Card.Header>
					<Card.Title>Form</Card.Title>
					<Card.Description>Fields keep tight 4px corners.</Card.Description>
				</Card.Header>
				<Card.Content class="gap-4">
					<div class="flex flex-col gap-2">
						<Label for="design-search">Search guests</Label>
						<Input id="design-search" placeholder="Ria" />
					</div>
					<div class="flex flex-col gap-2">
						<Label for="design-nights">Nights</Label>
						<Input id="design-nights" type="number" value="3" aria-invalid="true" />
						<p class="text-caption text-destructive">Nights must be between 1 and 365.</p>
					</div>
					<div class="flex flex-col gap-2">
						<Label>Sort</Label>
						<Select.Root type="single" bind:value={sort}>
							<Select.Trigger class="w-full">{sortLabel}</Select.Trigger>
							<Select.Content>
								<Select.Group>
									{#each sorts as option (option.value)}
										<Select.Item value={option.value} label={option.label} />
									{/each}
								</Select.Group>
							</Select.Content>
						</Select.Root>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root class="lg:col-span-2">
				<Card.Header>
					<Card.Title>Bookings</Card.Title>
					<Card.Description>Table headers use eyebrow caps on the warm canvas.</Card.Description>
				</Card.Header>
				<Card.Content class="gap-6">
					<Tabs.Root value="all">
						<Tabs.List>
							<Tabs.Trigger value="all">All</Tabs.Trigger>
							<Tabs.Trigger value="active">Active</Tabs.Trigger>
							<Tabs.Trigger value="loading">Loading</Tabs.Trigger>
						</Tabs.List>
						<Tabs.Content value="all">
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>Guest</Table.Head>
										<Table.Head>Property</Table.Head>
										<Table.Head class="text-right">Nights</Table.Head>
										<Table.Head class="text-right">Total</Table.Head>
										<Table.Head>Status</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each bookings as booking (booking.guest)}
										<Table.Row>
											<Table.Cell>{booking.guest}</Table.Cell>
											<Table.Cell class="text-ink-secondary whitespace-normal">{booking.property}</Table.Cell>
											<Table.Cell class="text-right tabular-nums">{booking.nights}</Table.Cell>
											<Table.Cell class="text-right tabular-nums">{booking.total}</Table.Cell>
											<Table.Cell>
												<Badge variant={statusBadge[booking.status as keyof typeof statusBadge]}>
													{booking.status.replace('_', ' ')}
												</Badge>
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						</Tabs.Content>
						<Tabs.Content value="active">
							<p class="text-body-sm text-muted-foreground py-6">Ria Dasgupta is checked in at Bloom Hotel.</p>
						</Tabs.Content>
						<Tabs.Content value="loading">
							<div class="flex flex-col gap-3 py-2">
								<Skeleton class="h-10 w-full" />
								<Skeleton class="h-10 w-full" />
								<Skeleton class="h-10 w-2/3" />
							</div>
						</Tabs.Content>
					</Tabs.Root>
				</Card.Content>
			</Card.Root>
		</div>
	</section>

	<Separator />

	<footer class="text-caption text-ink-secondary">
		Tokens live in <code>src/routes/layout.css</code>. The source is <code>DESIGN.md</code> at the repo root.
	</footer>
</main>
