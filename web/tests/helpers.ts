import { expect, type APIRequestContext, type Page } from '@playwright/test';

export type Guest = { id: string; name: string; wallet_balance: string };
export type Property = { id: string; title: string; base_price: string };
export type Booking = { id: string; guest_id: string; guest_name: string; status: string; total_cost: string };

/** Calls the API through the web server's /api proxy and returns the JSON body. */
export async function api<T>(request: APIRequestContext, method: 'GET' | 'POST', path: string, data?: unknown): Promise<T> {
	const response = await request.fetch(`/api${path}`, { method, data });
	const body = await response.json();
	expect(response.ok(), `${method} ${path} -> ${response.status()} ${JSON.stringify(body)}`).toBe(true);
	return body as T;
}

export async function firstItem<T>(request: APIRequestContext, path: string): Promise<T> {
	const page = await api<{ items: T[] }>(request, 'GET', path);
	expect(page.items.length, `no items from ${path}`).toBeGreaterThan(0);
	return page.items[0];
}

export const toPaise = (amount: string) => Math.round(Number(amount) * 100);

/** "₹1,23,456.78" the way the UI prints money (en-IN grouping, two decimals). */
export const rupees = (amount: string | number) =>
	new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(amount));

/** Sets the demo actor before the app loads, the same way the header switcher stores it. */
export async function actAs(page: Page, actor: { role: 'guest' | 'manager'; guestId: string | null }) {
	await page.addInitScript((value) => {
		localStorage.setItem('stayspot.actor', JSON.stringify(value));
		localStorage.setItem('mode-watcher-mode', 'light');
	}, actor);
}
