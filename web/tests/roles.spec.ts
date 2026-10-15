import { expect, test } from '@playwright/test';
import { actAs, firstItem, type Guest, type Property } from './helpers';

test('a visitor logs in from the booking panel', async ({ page, request }) => {
	const property = await firstItem<Property>(request, '/properties?sort=price_asc&limit=1');

	await actAs(page, { role: 'guest', guestId: null });
	await page.goto(`/properties/${property.id}`);

	// No account-only pages or numbers before logging in.
	const nav = page.getByRole('navigation', { name: 'Main' }).first();
	await expect(nav.getByRole('link', { name: 'Properties' })).toBeVisible();
	await expect(nav.getByRole('link', { name: 'My bookings' })).toHaveCount(0);
	await expect(page.getByText(/stays? completed|earned/)).toHaveCount(0);

	await page.getByRole('button', { name: 'Log in to continue' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('heading', { name: 'Log in' })).toBeVisible();
	await dialog.getByText('Lowest balance').click();

	await expect(dialog).toHaveCount(0);
	await expect(page.getByRole('button', { name: /^Book for/ })).toBeVisible();
	await expect(nav.getByRole('link', { name: 'My bookings' })).toBeVisible();
});

test('a visitor is asked to log in for bookings and the wallet', async ({ page, request }) => {
	const guest = await firstItem<Guest>(request, '/guests?limit=1');
	await actAs(page, { role: 'guest', guestId: null });

	await page.goto('/bookings');
	await expect(page.getByRole('heading', { name: 'Log in to see your bookings' })).toBeVisible();

	await page.goto(`/guests/${guest.id}/wallet`);
	await expect(page.getByRole('heading', { name: 'Log in to see your wallet' })).toBeVisible();
	await expect(page.getByRole('table')).toHaveCount(0);
});

test('a manager sees performance, not a booking panel or a guest picker', async ({ page, request }) => {
	const property = await firstItem<Property>(request, '/properties?sort=price_asc&limit=1');
	const guest = await firstItem<Guest>(request, '/guests?limit=1');
	await actAs(page, { role: 'manager', guestId: null });

	await page.goto(`/properties/${property.id}`);
	await expect(page.getByRole('heading', { name: 'Performance' })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Book for|Log in to continue/ })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Log in' })).toHaveCount(0);

	// A manager reads any wallet but cannot top it up.
	await page.goto(`/guests/${guest.id}/wallet`);
	await expect(page.getByRole('table', { name: 'Wallet transactions' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Top up', exact: true })).toHaveCount(0);
});

test('a guest cannot open manager pages', async ({ page, request }) => {
	const guest = await firstItem<Guest>(request, '/guests?limit=1');
	await actAs(page, { role: 'guest', guestId: guest.id });

	for (const path of ['/analytics', '/reviews', '/guests', `/guests/${guest.id}`]) {
		await page.goto(path);
		await expect(page.getByRole('heading', { name: 'For managers only' })).toBeVisible();
	}
});

test('a guest reads one property\'s reviews and filters them by tag', async ({ page, request }) => {
	const property = await firstItem<Property>(request, '/properties?sort=revenue&limit=1');
	await actAs(page, { role: 'guest', guestId: null });

	await page.goto(`/properties/${property.id}`);
	await expect(page.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name: /review/i })).toHaveCount(0);
	await page.getByRole('link', { name: /^Read all [\d,]+ reviews$/ }).click();
	await expect(page).toHaveURL(new RegExp(`/properties/${property.id}/reviews`));

	// The tag's frequency in the facets matches the filtered list's count.
	const tag = page.getByRole('list', { name: 'Top location tags' }).getByRole('button').first();
	const frequency = Number((await tag.getAttribute('aria-label'))!.match(/: ([\d,]+) reviews/)![1].replace(/,/g, ''));
	await tag.click();
	await expect(page.getByText(new RegExp(`^${frequency.toLocaleString('en-IN')} reviews?$`))).toBeVisible();
});
