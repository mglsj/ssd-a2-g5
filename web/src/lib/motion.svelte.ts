import { MediaQuery } from 'svelte/reactivity';

/** True when the viewer asked for less motion. Read `.current` inside effects and deriveds. */
export const reducedMotion = new MediaQuery('prefers-reduced-motion: reduce');

/** An animation length in ms, or 0 when the viewer asked for less motion. */
export function motionMs(ms: number): number {
	return reducedMotion.current ? 0 : ms;
}
