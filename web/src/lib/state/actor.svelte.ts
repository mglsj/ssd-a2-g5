import { createContext } from 'svelte';

export type Role = 'guest' | 'manager';

type StoredActor = { role: Role; guestId: string | null };

const STORAGE_KEY = 'stayspot.actor';

/** Reads the saved actor. Also used by load functions, which cannot reach context. */
export function readStoredActor(): StoredActor {
	try {
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<StoredActor> | null;
		return {
			role: stored?.role === 'manager' ? 'manager' : 'guest',
			guestId: typeof stored?.guestId === 'string' ? stored.guestId : null
		};
	} catch {
		return { role: 'guest', guestId: null };
	}
}

/** The demo actor: who is using the app, and which guest they act as. Kept in localStorage. */
export class Actor {
	#role = $state<Role>('guest');
	#guestId = $state<string | null>(null);

	constructor() {
		const stored = readStoredActor();
		this.#role = stored.role;
		this.#guestId = stored.guestId;
	}

	get role() {
		return this.#role;
	}

	set role(role: Role) {
		this.#role = role;
		this.#save();
	}

	get guestId() {
		return this.#guestId;
	}

	set guestId(id: string | null) {
		this.#guestId = id;
		this.#save();
	}

	get isManager() {
		return this.#role === 'manager';
	}

	#save() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ role: this.#role, guestId: this.#guestId }));
		} catch {
			// Private windows can block storage. The actor then lasts until reload.
		}
	}
}

export const [getActor, setActor] = createContext<Actor>();
