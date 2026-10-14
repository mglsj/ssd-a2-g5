import { expect, test } from '@playwright/test';
import { actAs, api, firstItem, type Guest } from './helpers';

const IIIT = { lat: 17.4455, lng: 78.3489 };

test('a dropped pin shows on the map and is stored', async ({ page, request }) => {
	const guest = await firstItem<Guest>(request, '/guests?limit=1');
	const before = new Date(Date.now() - 1000).toISOString();

	await actAs(page, { role: 'guest', guestId: guest.id });
	await page.goto('/map');

	// Wait for the first pin load, then read the count in the live pill.
	const pill = page.getByText(/· [\d,]+ pins/);
	await expect(page.getByText(/Live · updated/)).toBeVisible();
	const countOf = async () => Number((await pill.textContent())!.replace(/\D/g, ''));
	const pinsBefore = await countOf();

	await page.getByRole('button', { name: 'Drop a pin' }).first().click();
	await expect(page.getByText('Click the map to drop a pin')).toBeVisible();
	// Off-centre, so the click misses the origin marker.
	const canvas = page.locator('.maplibregl-canvas');
	const box = (await canvas.boundingBox())!;
	await canvas.click({ position: { x: box.width / 2 + 80, y: box.height / 2 + 60 } });

	await expect(page.getByText('Pin dropped')).toBeVisible();
	await expect.poll(countOf).toBe(pinsBefore + 1);

	const pins = await api<{ features: { properties: { user_id: string } }[] }>(
		request,
		'GET',
		`/map/pins?lat=${IIIT.lat}&lng=${IIIT.lng}&radius=5000&after=${encodeURIComponent(before)}`
	);
	expect(pins.features.some((pin) => pin.properties.user_id === guest.id)).toBe(true);
});
