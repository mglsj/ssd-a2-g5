import { redirect } from '@sveltejs/kit';
import { readStoredActor } from '#lib/state/actor.svelte.js';

export function load() {
	redirect(307, readStoredActor().role === 'manager' ? '/analytics' : '/properties');
}
