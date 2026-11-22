import { expect, hits, login, mock, test } from './helpers.ts';

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

test('searching and paging reuse the meta options loaded with the collection', async ({ page }) => {
	const META = 'GET /api/collections/meta/records';
	await page.goto('/movies?view=table');
	const loaded = await hits(META);
	expect(loaded).toBeGreaterThan(0);
	await page.getByLabel('Search Movies').fill('movie');
	await expect(page).toHaveURL(/q=movie/);
	await page.getByRole('link', { name: 'Next page' }).click();
	await expect(page.getByText('Page 2 of 2')).toBeVisible();
	expect(await hits(META)).toBe(loaded);
});

test('search finds a record by any one of its tags', async ({ page }) => {
	// The seeded video is tagged [go, programming]; "go" matches only one of the two.
	await page.goto('/videos');
	await page.getByLabel('Search Videos').fill('go');
	await expect(page).toHaveURL(/q=go/);
	await expect(page.locator('tbody tr')).toHaveCount(1);
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

test('the table becomes a stacked list of links on phones', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'phone layout only');
	await page.goto('/movies?view=table&sort=-title');
	await expect(page.getByRole('table')).toBeHidden();
	const row = page.getByRole('link', { name: /O'Brien/ });
	await expect(row).toBeVisible();
	await expect(row).toHaveAttribute('href', /^\/movies\/\w+$/);
});

test('the sidebar groups the collections and marks the current one', async ({ page, isMobile }) => {
	await page.goto('/movies');
	const nav = page.getByRole('navigation', { name: 'Collections' });
	const physical = nav.getByRole('list', { name: 'Physical' });
	await expect(physical.getByRole('link')).toHaveCount(7);
	await expect(nav.getByRole('list', { name: 'Digital' }).getByRole('link')).toHaveCount(8);
	await expect(nav.getByRole('list', { name: 'Vocabulary' }).getByRole('link')).toHaveCount(1);
	const current = physical.getByRole('link', { name: /Movies/ });
	await expect(current).toHaveAttribute('aria-current', 'page');
	// Counts show in the desktop sidebar; the phone pill row leaves them out.
	if (isMobile) await expect(current).toHaveAccessibleName('Movies');
	else await expect(current).toHaveAccessibleName(/Movies\s*35/);
});

test('the skip link moves focus into the main area', async ({ page, isMobile }) => {
	test.skip(isMobile, 'no Tab key on phones');
	await page.goto('/movies');
	await page.keyboard.press('Tab');
	await page.keyboard.press('Enter');
	await expect(page.locator('main#content')).toBeFocused();
});
