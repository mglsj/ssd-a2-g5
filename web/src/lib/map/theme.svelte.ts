import { mode } from 'mode-watcher';

/** IIIT Hyderabad, the default origin for Workflow 3 and the "Near IIIT" filter. */
export const IIIT = { lat: 17.4455, lng: 78.3489 } as const;

/** OpenFreeMap needs no API key. Positron is the quiet grey basemap; dark matches it at night. */
export const basemap = {
	light: 'https://tiles.openfreemap.org/styles/positron',
	dark: 'https://tiles.openfreemap.org/styles/dark'
} as const;

/**
 * A hex token as an rgba() string for MapLibre ramps. `shade` below 1 darkens it toward black,
 * for the deep end of a one-hue ramp.
 */
export function rgba(hex: string, alpha: number, shade = 1): string {
	const value = hex.replace('#', '');
	const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value.slice(0, 6);
	const [r, g, b] = [0, 2, 4].map((i) => Math.round(parseInt(full.slice(i, i + 2), 16) * shade));
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Reads a colour token from layout.css. MapLibre paint needs real colours, not var(). */
function token(name: string): string {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Map colours from the design tokens, re-read when the colour mode changes.
 * Use inside components: `const theme = new MapTheme()`.
 */
export class MapTheme {
	/** False until mode-watcher has read the stored mode. Create the map after this, so it starts on the right style. */
	readonly ready = $derived(mode.current !== undefined);
	readonly isDark = $derived(mode.current === 'dark');
	readonly style = $derived(this.isDark ? basemap.dark : basemap.light);
	readonly colors = $derived.by(() => {
		// Read after the mode class is applied, so the dark tokens are picked up.
		void this.isDark;
		return {
			primary: token('--primary'),
			foreground: token('--foreground'),
			card: token('--card'),
			muted: token('--muted-foreground'),
			chart: [1, 2, 3, 4, 5].map((i) => token(`--chart-${i}`)),
			destructive: token('--destructive'),
			lodging: token('--map-lodging'),
			lodgingForeground: token('--map-lodging-foreground')
		};
	});
}
