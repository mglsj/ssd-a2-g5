import { expect, test } from '@playwright/test';
import { actAs, api, firstItem, rupees, toPaise, type Guest, type Property } from './helpers';

test('a booking the wallet cannot cover fails and leaves the balance unchanged', async ({ page, request }) => {
	const guest = await firstItem<Guest>(request, '/guests?sort=balance_asc&limit=1');
	const property = await firstItem<Property>(request, '/properties?sort=price_desc&limit=1');
	const nights = Math.floor(toPaise(guest.wallet_balance) / toPaise(property.base_price)) + 1;
	test.skip(nights > 365, 'The poorest guest can afford a year at the dearest property');

	const bookingsBefore = await api<{ total: number }>(request, 'GET', `/bookings?guest_id=${guest.id}&limit=1`);

	await actAs(page, { role: 'guest', guestId: guest.id });
	await page.goto(`/properties/${property.id}`);
	await page.getByLabel('Nights').fill(String(nights));
	await page.getByLabel('Nights').blur();
	const book = page.getByRole('button', { name: /^Book for/ });
	await expect(book).toBeEnabled();
	await book.click();

	await expect(page.getByText('Not enough in the wallet')).toBeVisible();
	await expect(page.getByText(/Nothing was charged/)).toContainText(rupees(guest.wallet_balance));

	const after = await api<Guest>(request, 'GET', `/guests/${guest.id}`);
	expect(after.wallet_balance).toBe(guest.wallet_balance);
	const bookingsAfter = await api<{ total: number }>(request, 'GET', `/bookings?guest_id=${guest.id}&limit=1`);
	expect(bookingsAfter.total).toBe(bookingsBefore.total);
});

test('top up, then book, then see both audit rows', async ({ page, request }) => {
	// Not the poorest guest, so the first test keeps its low-balance demo guest.
	const guest = await firstItem<Guest>(request, '/guests?sort=balance_asc&limit=1&page=2');
	const property = await firstItem<Property>(request, '/properties?sort=price_asc&limit=1');
	const topUp = (Math.ceil(Number(property.base_price)) + 100).toFixed(2);

	await actAs(page, { role: 'guest', guestId: guest.id });

	// Top up from the wallet page.
	await page.goto(`/guests/${guest.id}/wallet`);
	await page.getByRole('button', { name: 'Top up', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('textbox', { name: 'Amount' }).fill(topUp);
	await dialog.getByRole('button', { name: /^Add ₹/ }).click();
	await expect(dialog.getByRole('heading', { name: 'Wallet topped up' })).toBeVisible();
	await dialog.getByRole('button', { name: 'Done' }).click();

	// Book one night.
	await page.goto(`/properties/${property.id}`);
	await page.getByLabel('Nights').fill('1');
	await page.getByLabel('Nights').blur();
	await page.getByRole('button', { name: /^Book for/ }).click();
	await expect(page.getByText(`1 night for ${guest.name}`)).toBeVisible();

	// The newest audit rows are the booking's debit, then the top-up's credit.
	await page.goto(`/guests/${guest.id}/wallet`);
	const rows = page.getByRole('table', { name: 'Wallet transactions' }).locator('tbody tr');
	await expect(rows.nth(0)).toContainText('Debit');
	await expect(rows.nth(0)).toContainText(rupees(property.base_price).replace('₹', ''));
	await expect(rows.nth(1)).toContainText('Credit');
	await expect(rows.nth(1)).toContainText(rupees(topUp).replace('₹', ''));
});
