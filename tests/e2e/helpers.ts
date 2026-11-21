import { test as base, expect, type Page } from '@playwright/test';

export const MOCK_PB = 'http://127.0.0.1:8099';
export const ADMIN = { email: 'admin@test.local', password: 'password123' };

export async function mock(path: string, body: object = {}) {
	const res = await fetch(`${MOCK_PB}/__mock/${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new Error(`mock ${path} failed: ${res.status}`);
}

export async function login(page: Page, next = '/') {
	await page.goto(`/login?next=${encodeURIComponent(next)}`);
	await page.getByLabel('Email').fill(ADMIN.email);
	await page.getByLabel('Password').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/** Every spec starts from freshly seeded mock data. */
export const test = base.extend<{ resetMock: void }>({
	resetMock: [
		// Playwright requires an object pattern here, even when no fixtures are used.
		// eslint-disable-next-line no-empty-pattern
		async ({}, use) => {
			await mock('reset');
			await use();
		},
		{ auto: true }
	]
});

/** Every URL stored in the caches whose name starts with `prefix`. */
export async function cachedUrls(page: Page, prefix: string) {
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

export { expect };
