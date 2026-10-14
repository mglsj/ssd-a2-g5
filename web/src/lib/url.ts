import { goto } from '$app/navigation';
import { page } from '$app/state';

type ParamValue = string | number | boolean | null | undefined;

/**
 * Writes filters, sort, page and tab into the query string. An empty value removes the key.
 * Any change other than `page` sends the list back to page 1.
 */
export function setParams(params: Record<string, ParamValue>, { push = false } = {}) {
	const url = new URL(page.url.href);
	for (const [key, value] of Object.entries(params)) {
		if (value === null || value === undefined || value === '' || value === false) url.searchParams.delete(key);
		else url.searchParams.set(key, String(value));
	}
	if (!('page' in params)) url.searchParams.delete('page');
	return goto(url, { replace: !push, reset: false });
}

export function stringParam(name: string): string {
	return page.url.searchParams.get(name) ?? '';
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
