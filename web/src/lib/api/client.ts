import type { ClientResponse } from 'hono/client';
import type { SuccessStatusCode } from 'hono/utils/http-status';
import { browser } from '$app/env';
import { createClient } from '../../../../api/src/client.ts';
import { ApiError } from './errors.js';

// The browser only talks to the web origin. src/hooks.server.ts forwards /api/* to the API.
export const api = createClient(browser ? window.location.origin : 'http://localhost').api;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResponse = ClientResponse<any, number, string>;

/** The body type of the 2xx responses a route declares. */
export type Success<R> =
	R extends ClientResponse<infer T, infer S, infer _F> ? (S extends SuccessStatusCode ? T : never) : never;

/** Awaits a client call and returns its JSON body, or throws an ApiError for any other status. */
export async function unwrap<R extends AnyResponse>(request: Promise<R>): Promise<Success<R>> {
	let response: R;
	try {
		response = await request;
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') throw error;
		throw new ApiError(0, 'DB_UNAVAILABLE', 'Could not reach the server. Check that the web server is running.');
	}
	const body: unknown = await response.json().catch(() => null);
	if (response.ok) return body as Success<R>;
	throw ApiError.from(response.status, body);
}
