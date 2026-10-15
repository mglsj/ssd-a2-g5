import { keepPreviousData, queryOptions, type QueryClient } from '@tanstack/svelte-query';
import type { BookingStatus } from '#lib/format.js';
import { api, unwrap, type Success } from './client.js';

/** The query-string type a client route accepts. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryOf<F extends (args: any, ...rest: any[]) => any> = NonNullable<Parameters<F>[0]> extends { query?: infer Q }
	? NonNullable<Q>
	: never;

export type GuestListQuery = QueryOf<typeof api.guests.$get>;
export type PropertyListQuery = QueryOf<typeof api.properties.$get>;
export type BookingListQuery = QueryOf<typeof api.bookings.$get>;
export type ReviewListQuery = QueryOf<typeof api.reviews.$get>;
export type AreaQuery = QueryOf<typeof api.map.area.$get>;
export type WindowQuery = QueryOf<typeof api.map.hotspots.$get>;
export type PinQuery = QueryOf<typeof api.map.pins.$get>;
export type MapPropertiesQuery = QueryOf<typeof api.map.properties.$get>;
export type AuditQuery = QueryOf<(typeof api.guests)[':id']['audit']['$get']>;
export type MovingAverageQuery = QueryOf<typeof api.analytics['moving-average']['$get']>;
export type RankQuery = QueryOf<typeof api.analytics.rank.$get>;
export type SummaryQuery = QueryOf<typeof api.analytics.summary.$get>;

export type GuestDetail = Success<Awaited<ReturnType<(typeof api.guests)[':id']['$get']>>>;
export type PropertyDetail = Success<Awaited<ReturnType<(typeof api.properties)[':id']['$get']>>>;
export type Amenities = Success<Awaited<ReturnType<(typeof api.properties)[':id']['amenities']['$get']>>>;
export type Booking = Success<Awaited<ReturnType<(typeof api.bookings)[':id']['$get']>>>;
export type ReviewFacets = Success<Awaited<ReturnType<typeof api.reviews.analytics.$get>>>;
export type Review = Success<Awaited<ReturnType<typeof api.reviews.$get>>>['items'][number];
export type MovingAverage = Success<Awaited<ReturnType<typeof api.analytics['moving-average']['$get']>>>;
export type Ranking = Success<Awaited<ReturnType<typeof api.analytics.rank.$get>>>;
export type SummaryPage = Success<Awaited<ReturnType<typeof api.analytics.summary.$get>>>;
export type AuditPage = Success<Awaited<ReturnType<(typeof api.guests)[':id']['audit']['$get']>>>;
export type ReviewDraft = Parameters<typeof api.reviews.$post>[0]['json'];
export type ReviewEligibility = Success<Awaited<ReturnType<typeof api.reviews.eligibility.$get>>>;
export type Hotspots = Success<Awaited<ReturnType<typeof api.map.hotspots.$get>>>;
export type Hotspot = Hotspots['features'][number];
export type PinPage = Success<Awaited<ReturnType<typeof api.map.pins.$get>>>;
export type Pin = PinPage['features'][number];
export type HeatCells = Success<Awaited<ReturnType<typeof api.map.heat.$get>>>;
export type Density = Success<Awaited<ReturnType<typeof api.map.density.$get>>>;
export type AuditEntry = NonNullable<GuestDetail['latest_audit']>;
export type BookingResult = Success<Awaited<ReturnType<typeof api.bookings.$post>>>;
export type TopUpResult = Success<Awaited<ReturnType<(typeof api.guests)[':id']['top-up']['$post']>>>;

type Status = 'ok' | 'down';
export type Health = { api: Status; postgres: Status; mongo: Status };

/** The API's page size limits, so no list ever asks for more than 100 rows. */
export const PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

const init = (signal: AbortSignal) => ({ init: { signal } });

// Query keys start with the resource name, so invalidating ['guests'] covers every guest query.
export const keys = {
	health: ['health'] as const,
	guests: {
		all: ['guests'] as const,
		list: (query: GuestListQuery) => ['guests', 'list', query] as const,
		detail: (id: string) => ['guests', 'detail', id] as const,
		audit: (id: string, query: AuditQuery) => ['guests', 'audit', id, query] as const
	},
	properties: {
		all: ['properties'] as const,
		list: (query: PropertyListQuery) => ['properties', 'list', query] as const,
		detail: (id: string) => ['properties', 'detail', id] as const,
		amenities: (id: string) => ['properties', 'amenities', id] as const
	},
	bookings: {
		all: ['bookings'] as const,
		list: (query: BookingListQuery) => ['bookings', 'list', query] as const,
		detail: (id: string) => ['bookings', 'detail', id] as const
	},
	reviews: {
		all: ['reviews'] as const,
		facets: (propertyId: string | null) => ['reviews', 'facets', propertyId] as const,
		list: (query: ReviewListQuery) => ['reviews', 'list', query] as const,
		eligibility: (guestId: string, propertyId: string) => ['reviews', 'eligibility', guestId, propertyId] as const
	},
	map: {
		all: ['map'] as const,
		area: (query: AreaQuery) => ['map', 'area', query] as const,
		hotspots: (query: WindowQuery) => ['map', 'hotspots', query] as const,
		heat: (query: WindowQuery) => ['map', 'heat', query] as const,
		density: (query: WindowQuery) => ['map', 'density', query] as const,
		properties: (query: MapPropertiesQuery) => ['map', 'properties', query] as const
	},
	analytics: {
		all: ['analytics'] as const,
		movingAverage: (query: MovingAverageQuery) => ['analytics', 'moving-average', query] as const,
		rank: (query: RankQuery) => ['analytics', 'rank', query] as const,
		summary: (query: SummaryQuery) => ['analytics', 'summary', query] as const
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
					const response = await api.health.$get(undefined, init(signal));
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
				queryFn: ({ signal }) => unwrap(api.guests.$get({ query }, init(signal))),
				placeholderData: keepPreviousData
			}),
		detail: (id: string) =>
			queryOptions({
				queryKey: keys.guests.detail(id),
				queryFn: ({ signal }) => unwrap(api.guests[':id'].$get({ param: { id } }, init(signal)))
			}),
		audit: (id: string, query: AuditQuery) =>
			queryOptions({
				queryKey: keys.guests.audit(id, query),
				queryFn: ({ signal }) => unwrap(api.guests[':id'].audit.$get({ param: { id }, query }, init(signal))),
				placeholderData: keepPreviousData
			})
	},

	properties: {
		list: (query: PropertyListQuery) =>
			queryOptions({
				queryKey: keys.properties.list(query),
				queryFn: ({ signal }) => unwrap(api.properties.$get({ query }, init(signal))),
				placeholderData: keepPreviousData
			}),
		detail: (id: string) =>
			queryOptions({
				queryKey: keys.properties.detail(id),
				queryFn: ({ signal }) => unwrap(api.properties[':id'].$get({ param: { id } }, init(signal)))
			}),
		amenities: (id: string) =>
			queryOptions({
				queryKey: keys.properties.amenities(id),
				queryFn: ({ signal }) => unwrap(api.properties[':id'].amenities.$get({ param: { id } }, init(signal))),
				staleTime: 5 * 60_000
			})
	},

	bookings: {
		list: (query: BookingListQuery) =>
			queryOptions({
				queryKey: keys.bookings.list(query),
				queryFn: ({ signal }) => unwrap(api.bookings.$get({ query }, init(signal))),
				placeholderData: keepPreviousData
			}),
		detail: (id: string) =>
			queryOptions({
				queryKey: keys.bookings.detail(id),
				queryFn: ({ signal }) => unwrap(api.bookings[':id'].$get({ param: { id } }, init(signal)))
			})
	},

	reviews: {
		facets: (propertyId: string | null) =>
			queryOptions({
				queryKey: keys.reviews.facets(propertyId),
				queryFn: ({ signal }) =>
					unwrap(
						api.reviews.analytics.$get({ query: propertyId ? { property_id: propertyId } : {} }, init(signal))
					)
			}),
		eligibility: (guestId: string, propertyId: string) =>
			queryOptions({
				queryKey: keys.reviews.eligibility(guestId, propertyId),
				queryFn: ({ signal }) =>
					unwrap(api.reviews.eligibility.$get({ query: { guest_id: guestId, property_id: propertyId } }, init(signal)))
			}),
		list: (query: ReviewListQuery) =>
			queryOptions({
				queryKey: keys.reviews.list(query),
				queryFn: ({ signal }) => unwrap(api.reviews.$get({ query }, init(signal))),
				placeholderData: keepPreviousData
			})
	},

	analytics: {
		movingAverage: (query: MovingAverageQuery) =>
			queryOptions({
				queryKey: keys.analytics.movingAverage(query),
				queryFn: ({ signal }) => unwrap(api.analytics['moving-average'].$get({ query }, init(signal))),
				placeholderData: keepPreviousData
			}),
		rank: (query: RankQuery) =>
			queryOptions({
				queryKey: keys.analytics.rank(query),
				queryFn: ({ signal }) => unwrap(api.analytics.rank.$get({ query }, init(signal))),
				placeholderData: keepPreviousData
			}),
		summary: (query: SummaryQuery) =>
			queryOptions({
				queryKey: keys.analytics.summary(query),
				queryFn: ({ signal }) => unwrap(api.analytics.summary.$get({ query }, init(signal))),
				placeholderData: keepPreviousData
			})
	},

	map: {
		area: (query: AreaQuery) =>
			queryOptions({
				queryKey: keys.map.area(query),
				queryFn: ({ signal }) => unwrap(api.map.area.$get({ query }, init(signal))),
				staleTime: Infinity
			}),
		// Hotspots and density refetch every 10 s. TanStack pauses this while the tab is hidden.
		hotspots: (query: WindowQuery) =>
			queryOptions({
				queryKey: keys.map.hotspots(query),
				queryFn: ({ signal }) => unwrap(api.map.hotspots.$get({ query }, init(signal))),
				refetchInterval: 10_000,
				placeholderData: keepPreviousData
			}),
		// Every pin in the window, binned, for the heatmap. The pins endpoint only has the nearest few thousand.
		heat: (query: WindowQuery) =>
			queryOptions({
				queryKey: keys.map.heat(query),
				queryFn: ({ signal }) => unwrap(api.map.heat.$get({ query }, init(signal))),
				refetchInterval: 10_000,
				placeholderData: keepPreviousData
			}),
		density: (query: WindowQuery) =>
			queryOptions({
				queryKey: keys.map.density(query),
				queryFn: ({ signal }) => unwrap(api.map.density.$get({ query }, init(signal))),
				refetchInterval: 10_000,
				placeholderData: keepPreviousData
			}),
		properties: (query: MapPropertiesQuery) =>
			queryOptions({
				queryKey: keys.map.properties(query),
				queryFn: ({ signal }) => unwrap(api.map.properties.$get({ query }, init(signal))),
				staleTime: 5 * 60_000,
				placeholderData: keepPreviousData
			})
	}
};

// Writes. Each returns the API's body, or throws an ApiError the screen shows by its code.
export const mutations = {
	book: (body: { guest_id: string; property_id: string; nights: number; check_in_date: string }) => unwrap(api.bookings.$post({ json: body })),
	createReview: (body: ReviewDraft) => unwrap(api.reviews.$post({ json: body })),
	topUp: (id: string, amount: string) => unwrap(api.guests[':id']['top-up'].$post({ param: { id }, json: { amount } })),
	pins: (query: PinQuery, signal?: AbortSignal) => unwrap(api.map.pins.$get({ query }, signal ? init(signal) : undefined)),
	dropPin: (body: { lat: number; lng: number; user_id?: string }) => unwrap(api.map.pins.$post({ json: body })),
	refreshSummary: () => unwrap(api.analytics.summary.refresh.$post()),
	setStatus: (id: string, status: BookingStatus) =>
		unwrap(api.bookings[':id'].status.$patch({ param: { id }, json: { status } }))
};

type BookingPage = Success<Awaited<ReturnType<typeof api.bookings.$get>>>;

/** Puts an updated booking into every cached list and its detail, so rows change in place. */
export function applyBooking(queryClient: QueryClient, booking: Booking) {
	queryClient.setQueryData(keys.bookings.detail(booking.id), booking);
	queryClient.setQueriesData<BookingPage>({ queryKey: ['bookings', 'list'] }, (page) =>
		page ? { ...page, items: page.items.map((item) => (item.id === booking.id ? booking : item)) } : page
	);
}
