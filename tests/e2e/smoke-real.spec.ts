/**
 * Read-only smoke test against a Bruinen instance wired to the real Rivendell.
 *   E2E_REAL_PB=1 BASE_URL=http://localhost:4173 REAL_PB_EMAIL=… REAL_PB_PASSWORD=… \
 *     npx playwright test smoke-real --project chromium
 * It signs in and opens every collection. It never opens the create form.
 */
import { expect, test } from '@playwright/test';
import { COLLECTIONS } from '../../src/lib/collections.ts';

const enabled = process.env.E2E_REAL_PB === '1';

test.describe('real Rivendell (read-only)', () => {
	test.skip(!enabled, 'set E2E_REAL_PB=1 to run against the real Rivendell');
	test.use({ baseURL: process.env.BASE_URL });

	test('signs in and opens every collection', async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel('Email').fill(process.env.REAL_PB_EMAIL ?? '');
		await page.getByLabel('Password').fill(process.env.REAL_PB_PASSWORD ?? '');
		await page.getByRole('button', { name: 'Sign in' }).click();
		await page.waitForURL((url) => !url.pathname.startsWith('/login'));

		for (const def of COLLECTIONS) {
			const res = await page.goto(`/${def.name}`);
			expect(res?.status(), def.name).toBe(200);
			await expect(page.getByRole('heading', { level: 1 }), def.name).toHaveText(def.label);
		}
	});
});
