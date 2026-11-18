import { expect, login, test } from './helpers.ts';

test('scanning fills the ISBN from the camera', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'only Chromium can fake a camera feed');
	await login(page);
	await page.goto('/books');
	await page.getByRole('button', { name: 'New Books' }).click();
	const dialog = page.getByRole('dialog', { name: 'New Books' });
	await dialog.getByRole('button', { name: 'Scan ISBN' }).click();
	await expect(page.getByRole('dialog', { name: 'Scan ISBN' })).toBeVisible();
	await expect(dialog.getByRole('textbox', { name: 'ISBN', exact: true })).toHaveValue(
		'9780451524935',
		{ timeout: 15_000 }
	);
	await expect(page.getByRole('dialog', { name: 'Scan ISBN' })).toBeHidden();
	await expect(dialog.getByRole('button', { name: 'Scan ISBN' })).toBeFocused();
});
