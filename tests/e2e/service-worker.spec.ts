import { COVER_OK } from './mock-pb/seed.ts';
import { cachedUrls, expect, login, test } from './helpers.ts';

test.beforeEach(async ({ page }) => login(page));

test('the service worker precaches the app shell', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await expect
		.poll(async () => (await cachedUrls(page, 'bruinen-static-')).some((u) => u.endsWith('.js')))
		.toBe(true);
	const urls = await cachedUrls(page, 'bruinen-static-');
	expect(urls.some((u) => u.endsWith('.css'))).toBe(true);
	// The barcode scanner's zxing build, so scanning doesn't wait on a multi-MB download.
	expect(urls.some((u) => u.endsWith('.wasm'))).toBe(true);
});

test('cover images are cached after they load', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
	await page.goto('/movies?view=cards&sort=title');
	await expect(page.getByRole('link', { name: /Movie 04/ }).locator('img')).toBeVisible();
	await expect.poll(() => cachedUrls(page, 'bruinen-images')).toContain(COVER_OK);
});
