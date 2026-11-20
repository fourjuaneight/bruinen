import { COVER_OK } from './mock-pb/seed.ts';
import { expect, login, test } from './helpers.ts';

test.beforeEach(async ({ page }) => login(page));

/** Every URL stored in the caches whose name starts with `prefix`. */
async function cachedUrls(page: import('@playwright/test').Page, prefix: string) {
	return page.evaluate(async (prefix) => {
		const names = (await caches.keys()).filter((name) => name.startsWith(prefix));
		const urls: string[] = [];
		for (const name of names) {
			const cache = await caches.open(name);
			urls.push(...(await cache.keys()).map((request) => request.url));
		}
		return urls;
	}, prefix);
}

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
	await expect(page.getByRole('img', { name: 'Movie 04' })).toBeVisible();
	await expect.poll(() => cachedUrls(page, 'bruinen-images')).toContain(COVER_OK);
});
