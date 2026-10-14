import { expect, test } from '@playwright/test';
import { actAs, api, firstItem, type Booking, type Guest, type Property } from './helpers';

test('a second check-in is blocked and links to the active stay', async ({ page, request }) => {
	// A guest who is already checked in somewhere, and their active booking.
	const guest = await firstItem<Guest>(request, '/guests?has_active_stay=true&limit=1');
	const active = await firstItem<Booking>(request, `/bookings?guest_id=${guest.id}&status=CHECKED_IN&limit=1`);

	// Give them a second, CONFIRMED booking to try to check in.
	const property = await firstItem<Property>(request, '/properties?sort=price_asc&limit=1');
	await api(request, 'POST', `/guests/${guest.id}/top-up`, { amount: property.base_price });
	const { booking } = await api<{ booking: Booking }>(request, 'POST', '/bookings', {
		guest_id: guest.id,
		property_id: property.id,
		nights: 1
	});

	await actAs(page, { role: 'manager', guestId: null });
	await page.goto(`/bookings/${booking.id}`);
	await page.getByRole('button', { name: /^Check in/ }).first().click();

	await expect(page.getByText(`${guest.name} is already checked in`)).toBeVisible();
	await expect(page.getByRole('link', { name: 'Open that stay' })).toHaveAttribute('href', `/bookings/${active.id}`);

	const after = await api<Booking>(request, 'GET', `/bookings/${booking.id}`);
	expect(after.status).toBe('CONFIRMED');
});
