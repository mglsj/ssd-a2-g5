import { mutations, type Pin } from '#lib/api/queries.js';

const POLL_MS = 5_000;
/** Pins live 2 hours in SearchSessions (the TTL index). The client drops them on the same clock. */
const WINDOW_MS = 2 * 60 * 60 * 1000;
/** A new pin pulses on the map for this long. */
export const FRESH_MS = 4_000;
const MAX_PINS = 5_000;

type Origin = { lat: number; lng: number };

/**
 * Live search pins around an origin. Loads every pin once, then every 5 s asks only for
 * pins after the newest one seen (`?after=cursor`) and merges them by id. Polling pauses
 * while the tab is hidden and resumes, with an immediate catch-up, when it is shown again.
 */
export class LivePins {
	pins = $state.raw<Pin[]>([]);
	/**
	 * When each pin arrived in this browser, so new ones can pulse. Initial pins are not fresh.
	 * Both fields are replaced whole on every merge, never mutated, so plain Map in $state.raw is enough.
	 */
	arrived = $state.raw<Map<string, number>>(new Map());
	updatedAt = $state<number | null>(null);
	error = $state<unknown>(null);
	loading = $state(true);
	paused = $state(false);

	#origin: Origin;
	#cursor: string | null = null;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#controller: AbortController | null = null;
	#stopped = false;

	constructor(origin: Origin) {
		this.#origin = origin;
	}

	start() {
		this.#stopped = false;
		document.addEventListener('visibilitychange', this.#onVisibility);
		void this.#tick();
	}

	stop() {
		this.#stopped = true;
		clearTimeout(this.#timer);
		this.#controller?.abort();
		document.removeEventListener('visibilitychange', this.#onVisibility);
	}

	/** Adds a pin this browser created, without waiting for the next poll. */
	add(pin: Pin) {
		this.#merge([pin], true);
	}

	#onVisibility = () => {
		this.paused = document.hidden;
		clearTimeout(this.#timer);
		if (!document.hidden && !this.#stopped) void this.#tick();
	};

	async #tick() {
		if (this.#stopped || document.hidden) {
			this.paused = document.hidden;
			return;
		}
		this.#controller?.abort();
		this.#controller = new AbortController();
		try {
			const page = await mutations.pins(
				{
					lat: String(this.#origin.lat),
					lng: String(this.#origin.lng),
					...(this.#cursor ? { after: this.#cursor } : {})
				},
				this.#controller.signal
			);
			// The first load is the backlog. Only pins that arrive afterwards pulse.
			this.#merge(page.features, this.#cursor !== null);
			this.#cursor = page.cursor ?? this.#cursor;
			this.updatedAt = Date.now();
			this.error = null;
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			this.error = error;
		} finally {
			this.loading = false;
		}
		if (!this.#stopped) this.#timer = setTimeout(() => void this.#tick(), POLL_MS);
	}

	#merge(incoming: Pin[], fresh: boolean) {
		const now = Date.now();
		const byId = new Map(this.pins.map((pin) => [String(pin.id), pin]));
		const arrived = new Map(this.arrived);
		for (const pin of incoming) {
			const id = String(pin.id);
			if (!byId.has(id) && fresh) arrived.set(id, now);
			byId.set(id, pin);
		}
		const cutoff = now - WINDOW_MS;
		const kept = [...byId.values()]
			.filter((pin) => Date.parse(pin.properties.created_at) >= cutoff)
			.sort((a, b) => Date.parse(b.properties.created_at) - Date.parse(a.properties.created_at))
			.slice(0, MAX_PINS);
		for (const [id, at] of arrived) if (now - at > FRESH_MS) arrived.delete(id);
		this.pins = kept;
		this.arrived = arrived;
	}
}
