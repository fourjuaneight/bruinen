import { expect, login, test } from './helpers.ts';

test('scanning fills the ISBN from the camera', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'only Chromium can fake a camera feed');
	await login(page);
	await page.goto('/books');
	await page.getByRole('button', { name: 'Add book' }).click();
	const dialog = page.getByRole('dialog', { name: 'Add book' });
	await dialog.getByRole('button', { name: 'Scan ISBN' }).click();
	await expect(page.getByRole('dialog', { name: 'Scan ISBN' })).toBeVisible();
	await expect(dialog.getByRole('textbox', { name: 'ISBN', exact: true })).toHaveValue(
		'9780451524935',
		{ timeout: 15_000 }
	);
	await expect(page.getByRole('dialog', { name: 'Scan ISBN' })).toBeHidden();
	await expect(dialog.getByRole('button', { name: 'Scan ISBN' })).toBeFocused();
});

test('scanning from the search box finds the book by its ISBN', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'only Chromium can fake a camera feed');
	await page.setViewportSize({ width: 390, height: 844 });
	await login(page);
	await page.goto('/books?view=table');
	await page.getByRole('button', { name: 'Scan a barcode to search' }).click();
	await expect(page).toHaveURL(/q=9780451524935/, { timeout: 15_000 });
	await expect(page.getByLabel('Search Books')).toHaveValue('9780451524935');
	await expect(page.getByRole('link', { name: /Nineteen Eighty-Four/ })).toBeVisible();
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });

	test('the search box has no scan button', async ({ page }) => {
		await login(page);
		await page.goto('/books');
		await expect(page.getByRole('button', { name: 'Scan a barcode to search' })).toBeHidden();
	});
});
