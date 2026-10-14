<script lang="ts" module>
	export type ChartSeries = {
		key: string;
		label: string;
		/** A colour token, such as "--chart-1". Series keep their slot when others are added or removed. */
		color: string;
		points: { day: string; value: number }[];
	};

	/** Round tick steps (1, 2, 2.5, 5 × 10ⁿ) from zero to just above the largest value. */
	export function niceTicks(max: number, count = 4): number[] {
		if (!(max > 0)) return [0, 1];
		const raw = max / count;
		const magnitude = 10 ** Math.floor(Math.log10(raw));
		const norm = raw / magnitude;
		const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * magnitude;
		const top = Math.ceil(max / step) * step;
		return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
	}
</script>

<script lang="ts">
	import { longDay, rupees, rupeesCompact, shortDay } from '#lib/format.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		series: ChartSeries[];
		/** What the chart shows, for screen readers. */
		label: string;
		height?: number;
		/** Off when the page already keys each series, for example with removable chips. */
		legend?: boolean;
		class?: string;
	};

	let { series, label, height = 300, legend = true, class: className }: Props = $props();

	let width = $state(0);
	let active = $state<number | null>(null);

	// End labels need room on the right. On narrow screens the legend carries identity alone.
	const wide = $derived(width >= 640);
	const margin = $derived({ top: 12, right: wide ? 200 : 12, bottom: 28, left: 52 });
	const innerW = $derived(Math.max(0, width - margin.left - margin.right));
	const innerH = $derived(height - margin.top - margin.bottom);

	const days = $derived(series[0]?.points.map((p) => p.day) ?? []);
	const n = $derived(days.length);
	const ticks = $derived(niceTicks(Math.max(0, ...series.flatMap((s) => s.points.map((p) => p.value)))));
	const top = $derived(ticks[ticks.length - 1]);

	const x = (i: number) => (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
	const y = (v: number) => innerH - (v / top) * innerH;

	const paths = $derived(
		series.map((s) => ({
			...s,
			d: s.points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('')
		}))
	);

	// About one date label per 90px, always including the first and last day.
	const xTicks = $derived.by(() => {
		if (n === 0) return [];
		const want = Math.max(2, Math.min(7, Math.floor(innerW / 90)));
		const step = (n - 1) / (want - 1);
		return [...new Set(Array.from({ length: want }, (_, i) => Math.round(i * step)))];
	});

	// End labels sit at each line's last value. Where they would overlap they spread apart,
	// and a short leader line ties each label back to its line end.
	const endLabels = $derived.by(() => {
		if (!wide || n === 0) return [];
		const gap = 18;
		const placed = series
			.map((s) => ({ key: s.key, label: s.label, color: s.color, value: s.points[n - 1]?.value ?? 0 }))
			.map((s) => ({ ...s, lineY: y(s.value), labelY: y(s.value) }))
			.sort((a, b) => a.lineY - b.lineY);
		for (let i = 1; i < placed.length; i++) {
			placed[i].labelY = Math.max(placed[i].labelY, placed[i - 1].labelY + gap);
		}
		const overflow = placed.length ? placed[placed.length - 1].labelY - innerH : 0;
		if (overflow > 0) for (const p of placed) p.labelY -= overflow;
		return placed;
	});

	const tooltipRows = $derived(
		active === null
			? []
			: series
					.map((s) => ({ key: s.key, label: s.label, color: s.color, value: s.points[active!]?.value ?? 0 }))
					.sort((a, b) => b.value - a.value)
	);

	function valueText(i: number) {
		const values = series.map((s) => `${s.label} ${rupees(s.points[i]?.value ?? 0)}`).join(', ');
		return `${longDay(days[i] ?? '')}: ${values}`;
	}

	function truncate(text: string, max = 20) {
		return text.length > max ? `${text.slice(0, max - 1)}…` : text;
	}

	function pointAt(event: PointerEvent) {
		const rect = (event.currentTarget as SVGRectElement).getBoundingClientRect();
		const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
		active = Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1))));
	}

	function onKey(event: KeyboardEvent) {
		if (n === 0) return;
		const current = active ?? n - 1;
		const moves: Record<string, number> = {
			ArrowLeft: current - 1,
			ArrowRight: current + 1,
			Home: 0,
			End: n - 1,
			PageUp: current - 7,
			PageDown: current + 7
		};
		if (event.key in moves) {
			event.preventDefault();
			active = Math.min(n - 1, Math.max(0, moves[event.key]));
		} else if (event.key === 'Escape') {
			active = null;
		}
	}
</script>

<div class={cn('flex flex-col gap-3', className)}>
	<!-- Legend: line keys, never colour alone. -->
	{#if legend}
		<ul class="text-caption flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Series">
			{#each series as s (s.key)}
				<li class="flex min-w-0 items-center gap-1.5">
					<span class="h-0.5 w-4 shrink-0 rounded-full" style:background-color="var({s.color})" aria-hidden="true"></span>
					<span class="text-ink-secondary truncate">{s.label}</span>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="relative" bind:clientWidth={width} style:height="{height}px">
		{#if width > 0 && n > 0}
			<!-- A slider over the days: arrow keys step through them and each step reads out every series. -->
			<svg
				{width}
				{height}
				role="slider"
				aria-label="{label}. Use the arrow keys to read each day."
				aria-valuemin={0}
				aria-valuemax={n - 1}
				aria-valuenow={active ?? n - 1}
				aria-valuetext={valueText(active ?? n - 1)}
				tabindex="0"
				class="focus-visible:ring-ring/50 rounded-md outline-none focus-visible:ring-[3px]"
				onkeydown={onKey}
				onfocus={() => (active ??= n - 1)}
				onblur={() => (active = null)}
			>
				<g transform="translate({margin.left},{margin.top})">
					<!-- Hairline grid and y ticks -->
					{#each ticks as tick (tick)}
						<line x1="0" x2={innerW} y1={y(tick)} y2={y(tick)} class="stroke-border" stroke-width="1" />
						<text x="-8" y={y(tick)} dy="0.32em" text-anchor="end" class="fill-muted-foreground text-[11px] tabular-nums">
							{rupeesCompact(tick)}
						</text>
					{/each}
					{#each xTicks as i (i)}
						<text
							x={x(i)}
							y={innerH + 18}
							text-anchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
							class="fill-muted-foreground text-[11px]"
						>
							{shortDay(days[i])}
						</text>
					{/each}

					<!-- Lines: 2px, round joins -->
					{#each paths as s (s.key)}
						<path d={s.d} fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" style:stroke="var({s.color})" />
					{/each}

					<!-- End dots with a surface ring, and direct labels -->
					{#each endLabels as l (l.key)}
						<circle cx={x(n - 1)} cy={l.lineY} r="4" stroke-width="2" class="stroke-card" style:fill="var({l.color})" />
						{#if Math.abs(l.labelY - l.lineY) > 2}
							<path d="M{x(n - 1) + 6},{l.lineY} L{x(n - 1) + 14},{l.labelY}" class="stroke-muted-foreground" stroke-width="1" fill="none" />
						{/if}
						<text x={x(n - 1) + 18} y={l.labelY} dy="0.32em" class="text-[11px]">
							<tspan class="fill-foreground font-medium">{rupeesCompact(l.value)}</tspan>
							<tspan class="fill-muted-foreground" dx="4">{truncate(l.label)}</tspan>
						</text>
					{/each}

					<!-- Crosshair -->
					{#if active !== null}
						<line x1={x(active)} x2={x(active)} y1="0" y2={innerH} class="stroke-foreground/40" stroke-width="1" />
						{#each series as s (s.key)}
							<circle
								cx={x(active)}
								cy={y(s.points[active]?.value ?? 0)}
								r="4"
								stroke-width="2"
								class="stroke-card"
								style:fill="var({s.color})"
							/>
						{/each}
					{/if}

					<!-- The hit area is the whole plot, so the reader aims at a day, not at a 2px line. -->
					<rect
						width={innerW}
						height={innerH}
						fill="transparent"
						role="presentation"
						onpointermove={pointAt}
						onpointerdown={pointAt}
						onpointerleave={() => (active = null)}
					/>
				</g>
			</svg>

			{#if active !== null}
				{@const left = margin.left + x(active)}
				{@const flip = left > width / 2}
				<div
					class="bg-popover text-popover-foreground ring-foreground/10 shadow-elevated pointer-events-none absolute top-2 z-10 flex w-max max-w-64 flex-col gap-1.5 rounded-md p-3 text-xs ring-1"
					style:left="{flip ? left - 12 : left + 12}px"
					style:transform={flip ? 'translateX(-100%)' : undefined}
					aria-hidden="true"
				>
					<p class="text-muted-foreground font-medium">{longDay(days[active])} · 7-day average</p>
					<ul class="flex flex-col gap-1">
						{#each tooltipRows as row (row.key)}
							<li class="flex items-center gap-2">
								<span class="h-0.5 w-3 shrink-0 rounded-full" style:background-color="var({row.color})" aria-hidden="true"></span>
								<span class="text-foreground font-semibold tabular-nums">{rupees(row.value)}</span>
								<span class="text-muted-foreground truncate">{row.label}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/if}
	</div>
</div>
