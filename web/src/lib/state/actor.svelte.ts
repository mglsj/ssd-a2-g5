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

/**
 * The demo actor: a manager, or a guest who is logged in as one of the seeded guests or not at all.
 * Kept in localStorage. There are no passwords: logging in means picking a guest.
 */
export class Actor {
	#role = $state<Role>('guest');
	#guestId = $state<string | null>(null);
	/** Whether the login dialog is open. Any "Log in" button sets it. */
	loginOpen = $state(false);

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

	/**
	 * The logged-in guest, or null. A manager is never a guest, so this is null in manager mode.
	 * The stored guest is kept, so switching back to guest mode logs them back in.
	 */
	get guestId() {
		return this.#role === 'guest' ? this.#guestId : null;
	}

	set guestId(id: string | null) {
		this.#guestId = id;
		this.#save();
	}

	get isManager() {
		return this.#role === 'manager';
	}

	/** A guest who has logged in. */
	get signedIn() {
		return this.guestId !== null;
	}

	logIn() {
		this.loginOpen = true;
	}

	logOut() {
		this.guestId = null;
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
