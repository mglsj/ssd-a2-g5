import { mode } from 'mode-watcher';

/** IIIT Hyderabad, the default origin for Workflow 3 and the "Near IIIT" filter. */
export const IIIT = { lat: 17.4455, lng: 78.3489 } as const;

/** OpenFreeMap needs no API key. Positron is the quiet grey basemap; dark matches it at night. */
export const basemap = {
	light: 'https://tiles.openfreemap.org/styles/positron',
	dark: 'https://tiles.openfreemap.org/styles/dark'
} as const;

/** Reads a colour token from layout.css. MapLibre paint needs real colours, not var(). */
function token(name: string): string {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Map colours from the design tokens, re-read when the colour mode changes.
 * Use inside components: `const theme = new MapTheme()`.
 */
export class MapTheme {
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
			destructive: token('--destructive')
		};
	});
}
