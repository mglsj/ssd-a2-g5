import { goto } from '$app/navigation';
import { page } from '$app/state';

type ParamValue = string | number | boolean | null | undefined | readonly string[];

type Options = {
	/** Add a history entry instead of replacing the current one. */
	push?: boolean;
	/** Scroll back to the top once the URL has changed. */
	toTop?: boolean;
	/** Keep `page` when a filter changes, for a page whose filters do not scope the paged list. */
	keepPage?: boolean;
};

/**
 * Writes filters, sort, page and tab into the query string. An empty value removes the key,
 * and an array writes the key once per item. Any change other than `page` sends the list back to page 1.
 */
export async function setParams(params: Record<string, ParamValue>, { push = false, toTop = false, keepPage = false }: Options = {}) {
	const url = new URL(page.url.href);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.delete(key);
		if (Array.isArray(value)) {
			for (const item of value) url.searchParams.append(key, item);
		} else if (value !== null && value !== undefined && value !== '' && value !== false) {
			url.searchParams.set(key, String(value));
		}
	}
	if (!('page' in params) && !keepPage) url.searchParams.delete('page');
	await goto(url, { replace: !push, reset: false });
	// Paging scrolls back to the top. Filters keep the scroll position and focus.
	if (toTop) window.scrollTo({ top: 0 });
}

export function stringParam(name: string): string {
	return page.url.searchParams.get(name) ?? '';
}

export function listParam(name: string): string[] {
	return page.url.searchParams.getAll(name).filter(Boolean);
}

/** A YYYY-MM-DD date from the query string, or an empty string. */
export function dateParam(name: string): string {
	const value = stringParam(name);
	return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

/** A positive integer from the query string, or the fallback. */
export function intParam(name: string, fallback: number): number {
	const value = Number(page.url.searchParams.get(name));
	return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function enumParam<T extends string>(name: string, values: readonly T[], fallback: T): T {
	const value = page.url.searchParams.get(name);
	return values.includes(value as T) ? (value as T) : fallback;
}
