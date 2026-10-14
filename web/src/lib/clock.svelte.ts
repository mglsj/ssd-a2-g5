import { createSubscriber } from 'svelte/reactivity';

/**
 * The current time as a reactive value, for "updated N s ago" and short animations.
 * The interval runs only while something reads `now`, and stops when nothing does.
 */
export class Clock {
	#now = Date.now();
	#subscribe: () => void;

	constructor(intervalMs = 1000) {
		this.#subscribe = createSubscriber((update) => {
			const timer = setInterval(() => {
				this.#now = Date.now();
				update();
			}, intervalMs);
			return () => clearInterval(timer);
		});
	}

	get now() {
		this.#subscribe();
		return this.#now;
	}
}
