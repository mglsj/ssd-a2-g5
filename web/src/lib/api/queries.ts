import { queryOptions } from '@tanstack/svelte-query';
import { api, unwrap } from './client.js';

type GuestListQuery = NonNullable<Parameters<typeof api.guests.$get>[0]>['query'];

type Status = 'ok' | 'down';
export type Health = { api: Status; postgres: Status; mongo: Status };

// Query keys start with the resource name, so invalidating ['guests'] covers every guest query.
export const keys = {
	health: ['health'] as const,
	guests: {
		all: ['guests'] as const,
		list: (query: GuestListQuery) => ['guests', 'list', query] as const,
		detail: (id: string) => ['guests', 'detail', id] as const
	}
};

export const queries = {
	// The API answers 503 with the same { postgres, mongo } body, so read it for any status.
	// When the API itself is unreachable the proxy sends the error shape instead.
	health: () =>
		queryOptions({
			queryKey: keys.health,
			queryFn: async ({ signal }): Promise<Health> => {
				try {
					const response = await api.health.$get(undefined, { init: { signal } });
					const body: unknown = await response.json();
					if (body && typeof body === 'object' && 'postgres' in body) {
						return { ...(body as Omit<Health, 'api'>), api: 'ok' };
					}
				} catch (error) {
					if (error instanceof DOMException && error.name === 'AbortError') throw error;
				}
				return { api: 'down', postgres: 'down', mongo: 'down' };
			},
			refetchInterval: 30_000,
			retry: false
		}),

	guests: {
		list: (query: GuestListQuery) =>
			queryOptions({
				queryKey: keys.guests.list(query),
				queryFn: ({ signal }) => unwrap(api.guests.$get({ query }, { init: { signal } }))
			}),
		detail: (id: string) =>
			queryOptions({
				queryKey: keys.guests.detail(id),
				queryFn: ({ signal }) => unwrap(api.guests[':id'].$get({ param: { id } }, { init: { signal } }))
			})
	}
};
