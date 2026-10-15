import { expect, test, type Page } from '@playwright/test';
import { api, firstItem, toPaise, type Booking, type Guest, type Property } from './helpers';

// Writes the README screenshots to docs/design/screenshots. Run with `bash scripts/screenshots.sh`.
// Skipped in the normal test run. It books a stay and tops up a wallet, like the other tests.
test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1 to capture the README screenshots');
test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

const OUT = '../docs/design/screenshots';

async function prepare(page: Page, actor: { role: 'guest' | 'manager'; guestId: string | null }, mode: 'light' | 'dark' = 'light') {
	await page.addInitScript(
		([value, theme]) => {
			localStorage.setItem('stayspot.actor', JSON.stringify(value));
			localStorage.setItem('mode-watcher-mode', theme as string);
		},
		[actor, mode] as const
	);
}

async function shot(page: Page, name: string, fullPage = false) {
	// Let images, charts and map tiles settle.
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1200);
	await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
}

test.use({ viewport: { width: 1440, height: 900 } });

test('guest screens', async ({ page, request }) => {
	const rich = await firstItem<Guest>(request, '/guests?sort=balance_desc&limit=1');
	const poor = await firstItem<Guest>(request, '/guests?sort=balance_asc&limit=1');
	const cheap = await firstItem<Property>(request, '/properties?sort=price_asc&limit=1');
	const dear = await firstItem<Property>(request, '/properties?sort=price_desc&limit=1');
	const featured = await firstItem<Property>(request, '/properties?sort=revenue&limit=1');

	await prepare(page, { role: 'guest', guestId: rich.id });
	await page.goto('/properties');
	await expect(page.getByRole('heading', { name: 'Properties' })).toBeVisible();
	await shot(page, '01-properties');

	await page.goto(`/properties/${featured.id}`);
	await expect(page.getByText('Book this stay')).toBeVisible();
	await shot(page, '02-property-detail', true);

	await page.goto(`/properties/${cheap.id}`);
	await page.getByLabel('Nights').fill('2');
	await page.getByLabel('Nights').blur();
	await page.getByRole('button', { name: /^Book for/ }).click();
	await expect(page.getByText(`2 nights for ${rich.name}`)).toBeVisible();
	await shot(page, '03-booking-result');

	await page.goto(`/guests/${rich.id}/wallet`);
	await expect(page.getByRole('table', { name: 'Wallet transactions' })).toBeVisible();
	await shot(page, '05-wallet-audit');

	await page.goto(`/properties/${featured.id}/reviews`);
	await expect(page.getByRole('heading', { name: 'Ratings' })).toBeVisible();
	await shot(page, '15-property-reviews');

	// A booking the poorest guest cannot cover.
	const nights = Math.min(365, Math.floor(toPaise(poor.wallet_balance) / toPaise(dear.base_price)) + 1);
	await page.addInitScript((id) => localStorage.setItem('stayspot.actor', JSON.stringify({ role: 'guest', guestId: id })), poor.id);
	await page.goto(`/properties/${dear.id}`);
	await page.getByLabel('Nights').fill(String(nights));
	await page.getByLabel('Nights').blur();
	await page.getByRole('button', { name: /^Book for/ }).click();
	await expect(page.getByText('Not enough in the wallet')).toBeVisible();
	await page.getByText('Not enough in the wallet').scrollIntoViewIfNeeded();
	await shot(page, '04-booking-insufficient-balance');
});

test('manager screens', async ({ page, request }) => {
	await prepare(page, { role: 'manager', guestId: null });

	await page.goto('/guests');
	await expect(page.getByRole('heading', { name: 'Guests' })).toBeVisible();
	await shot(page, '07-guests');

	const rich = await firstItem<Guest>(request, '/guests?sort=balance_desc&limit=1');
	await page.goto(`/guests/${rich.id}`);
	await expect(page.getByRole('heading', { name: rich.name, level: 1 })).toBeVisible();
	await shot(page, '06-guest-detail');

	await page.goto('/bookings');
	await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible();
	await shot(page, '08-bookings');

	// The blocked second check-in, set up the same way as check-in.spec.ts.
	const guest = await firstItem<Guest>(request, '/guests?has_active_stay=true&limit=1');
	const property = await firstItem<Property>(request, '/properties?sort=price_asc&limit=1');
	await api(request, 'POST', `/guests/${guest.id}/top-up`, { amount: property.base_price });
	const { booking } = await api<{ booking: Booking }>(request, 'POST', '/bookings', {
		guest_id: guest.id,
		property_id: property.id,
		nights: 1
	});
	await page.goto(`/bookings/${booking.id}`);
	await page.getByRole('button', { name: /^Check in/ }).first().click();
	await expect(page.getByText(`${guest.name} is already checked in`)).toBeVisible();
	await shot(page, '09-second-check-in-blocked');

	// The map with the hotspot panel floating over it.
	await page.goto('/map');
	await expect(page.getByRole('heading', { name: /^Hotspots near/ })).toBeVisible();
	await page.waitForTimeout(2500);
	await shot(page, '10-map');

	await page.goto('/analytics');
	await expect(page.getByText('Revenue trend')).toBeVisible();
	await shot(page, '12-analytics', true);

	await page.goto('/reviews?tag=metro_station');
	await expect(page.getByRole('button', { name: /^Metro station:/ })).toHaveAttribute('aria-pressed', 'true');
	await shot(page, '11-reviews');
});

test.describe('phone and dark mode', () => {
	test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

	test('phone screens', async ({ page, request }) => {
		const rich = await firstItem<Guest>(request, '/guests?sort=balance_desc&limit=1');

		await prepare(page, { role: 'guest', guestId: rich.id });
		await page.goto('/properties');
		await expect(page.getByRole('heading', { name: 'Properties' })).toBeVisible();
		await shot(page, '13-phone-properties');

		await prepare(page, { role: 'manager', guestId: null }, 'dark');
		await page.goto('/map');
		await expect(page.getByText(/Live · updated/)).toBeVisible();
		const hotspots = page.getByRole('button', { name: /^Hotspots \([1-9]/ });
		await expect(hotspots).toBeEnabled();
		await hotspots.click();
		await expect(page.getByRole('dialog', { name: 'Hotspots' })).toBeVisible();
		await shot(page, '14-phone-map-dark');
	});
});
