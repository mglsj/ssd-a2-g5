import { expect, test } from '@playwright/test';
import { actAs, api, firstItem, type Guest } from './helpers';

const IIIT = { lat: 17.4455, lng: 78.3489 };

test('a dropped pin shows on the map and is stored', async ({ page, request }) => {
	const guest = await firstItem<Guest>(request, '/guests?limit=1');
	const before = new Date(Date.now() - 1000).toISOString();

	await actAs(page, { role: 'guest', guestId: guest.id });
	await page.goto('/map');

	// Wait for the first pin load, then read the count in the live pill.
	const pill = page.getByText(/· [\d,]+ search(es)?$/);
	await expect(page.getByText(/Live · updated/)).toBeVisible();
	const countOf = async () => Number((await pill.textContent())!.replace(/\D/g, ''));
	const pinsBefore = await countOf();

	await page.getByRole('button', { name: 'Drop a pin' }).click();
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

test('a guest sees a property preview on hover, and no hotspot list', async ({ page, request }) => {
	const nearest = await api<{ features: { geometry: { coordinates: [number, number] } }[] }>(
		request,
		'GET',
		`/map/properties?lat=${IIIT.lat}&lng=${IIIT.lng}&radius=5000`
	);
	const [lng, lat] = nearest.features[0].geometry.coordinates;

	// An empty basemap: the markers are ours, and the tile host can stall when tests load it again and again.
	await page.route('https://tiles.openfreemap.org/styles/**', (route) =>
		route.fulfill({ json: { version: 8, sources: {}, layers: [] } })
	);
	await actAs(page, { role: 'guest', guestId: null });
	// Centre the map 1 km south of the property, so its marker sits above the origin pin.
	const originLat = lat - 0.01;
	await page.goto(`/map?lat=${originLat}&lng=${lng}`);
	await expect(page.getByText(/Live · updated/)).toBeVisible();
	await expect(page.getByRole('button', { name: /^Hotspots/ })).toHaveCount(0);

	// Walk the pointer up from the origin pin until it is over a marker and its popup opens.
	// MapLibre needs real moves, so the pointer travels in steps rather than jumping.
	const box = (await page.locator('.maplibregl-canvas').boundingBox())!;
	const preview = page.locator('.stayspot-popup').getByRole('link');
	const x = box.x + box.width / 2;
	let y = 0;
	// The markers draw a moment after the page loads, so the walk repeats until one answers.
	await expect(async () => {
		y = box.y + box.height / 2 - 30;
		await page.mouse.move(x, y);
		while (!(await preview.isVisible()) && y > box.y + box.height / 2 - 160) {
			y -= 4;
			await page.mouse.move(x, y, { steps: 2 });
			await page.waitForTimeout(50);
		}
		await expect(preview).toBeVisible({ timeout: 100 });
	}).toPass({ timeout: 15_000 });
	await expect(preview).toHaveAttribute('href', /^\/properties\//);
	await expect(preview).toContainText('/ night');

	// A click on the marker opens that stay.
	const href = await preview.getAttribute('href');
	await page.mouse.click(x, y);
	await expect(page).toHaveURL(new RegExp(`${href}$`));
});

test('a manager reads the hotspot list over the map', async ({ page }) => {
	await actAs(page, { role: 'manager', guestId: null });
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/map');

	const panel = page.getByRole('complementary', { name: 'Hotspots' });
	await expect(panel.getByRole('heading', { name: /^Hotspots near/ })).toBeVisible();
	await page.getByRole('button', { name: /^Hotspots/ }).click();
	await expect(panel).toHaveCount(0);
});
