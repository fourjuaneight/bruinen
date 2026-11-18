import { expect, login, mock, test } from './helpers.ts';

test.beforeEach(async ({ page }) => login(page));

test('home lists every collection with its count', async ({ page }) => {
	await page.goto('/');
	const cards = page.getByRole('main').getByRole('link');
	await expect(cards).toHaveCount(16);
	await expect(page.getByRole('main').getByRole('link', { name: /Movies\s*35/ })).toBeVisible();
});

test('paginates 30 records per page', async ({ page }) => {
	await page.goto('/movies?view=table');
	await expect(page.locator('tbody tr')).toHaveCount(30);
	await expect(page.getByText('Page 1 of 2')).toBeVisible();
	await page.getByRole('link', { name: 'Next page' }).click();
	await expect(page.locator('tbody tr')).toHaveCount(5);
	await expect(page.getByText('Page 2 of 2')).toBeVisible();
});

test('searches with quotes in the text', async ({ page }) => {
	await page.goto('/movies?view=table');
	await page.getByLabel('Search Movies').fill("o'brien");
	await expect(page).toHaveURL(/q=o%27brien/);
	await expect(page.locator('tbody tr')).toHaveCount(1);
	await expect(page.getByRole('link', { name: "O'Brien" })).toBeVisible();
});

test('sorts by clicking a column header', async ({ page, isMobile }) => {
	test.skip(isMobile, 'headers are replaced by the sort select on phones');
	await page.goto('/movies?view=table');
	await page.getByRole('link', { name: 'Year' }).click();
	await expect(page.locator('tbody tr').first()).toContainText('1981');
	await page.getByRole('link', { name: 'Year' }).click();
	await expect(page.locator('tbody tr').first()).toContainText('2015');
});

test('sorts with the select on phones', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'phone layout only');
	await page.goto('/movies?view=table');
	await page.getByLabel('Sort by').selectOption({ label: 'Year (newest first)' });
	await expect(page).toHaveURL(/sort=-year/);
	await expect(page.locator('tbody tr').first()).toContainText('2015');
});

test('garbage URL params fall back to defaults', async ({ page }) => {
	await page.goto('/movies?page=abc&sort=password&view=x');
	await expect(page.getByText('Page 1 of 2')).toBeVisible();
});

test('a page past the end offers a way back', async ({ page }) => {
	await page.goto('/movies?page=999&view=table');
	await expect(page.getByText('Nothing on this page.')).toBeVisible();
	await page.getByRole('link', { name: 'Go to the first page' }).click();
	await expect(page.getByText('Page 1 of 2')).toBeVisible();
});

test('an unknown collection is a 404', async ({ page }) => {
	await page.goto('/nope');
	await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
});

test('says so when Rivendell is unreachable', async ({ page }) => {
	await mock('down', { down: true });
	const res = await page.goto('/movies');
	expect(res?.status()).toBe(503);
	await expect(page.getByRole('heading', { name: 'Rivendell is unreachable' })).toBeVisible();
});

test('table rows stack with labels on phones', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'phone layout only');
	await page.goto('/movies?view=table');
	const firstCell = page.locator('tbody tr').first().locator('td').nth(1);
	await expect(firstCell).toHaveAttribute('data-label', 'Director');
	const before = await firstCell.evaluate((el) => getComputedStyle(el, '::before').content);
	expect(before).toContain('Director');
});
