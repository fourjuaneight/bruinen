import { expect, login, test } from './helpers.ts';

test.beforeEach(async ({ page }) => login(page));

test('movies show cover cards, with a placeholder for a broken cover', async ({ page }) => {
	// Title order puts Movie 03 (cover 404s) and Movie 04 (cover loads) on the first page.
	await page.goto('/movies?view=cards&sort=title');
	await expect(page.getByRole('img', { name: 'Movie 04' })).toBeVisible();
	const broken = page.getByRole('listitem').filter({ hasText: 'Movie 03' });
	await expect(broken.getByTestId('cover-placeholder')).toBeVisible();
});

test('the view toggle switches to the table', async ({ page }) => {
	await page.goto('/movies?view=cards');
	await page.getByRole('link', { name: 'Table' }).click();
	await expect(page).toHaveURL(/view=table/);
	await expect(page.getByRole('table')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Table' })).toHaveAttribute('aria-current', 'page');
});

test('collections without covers have no cards toggle', async ({ page }) => {
	await page.goto('/articles');
	await expect(page.getByRole('link', { name: 'Cards' })).toHaveCount(0);
	await expect(page.getByRole('table')).toBeVisible();
});

test('a card opens the record with meta names', async ({ page }) => {
	await page.goto('/books?view=cards');
	await page.getByRole('link', { name: /Nineteen Eighty-Four/ }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nineteen Eighty-Four');
	await expect(page.getByText('fiction')).toBeVisible();
	await page.getByRole('link', { name: 'Back to Books' }).click();
	await expect(page).toHaveURL('/books?view=cards');
});

test('cover collections default to cards', async ({ page }) => {
	await page.goto('/games');
	await expect(page.getByRole('img', { name: 'Hollow Knight' })).toBeVisible();
	await expect(page.getByRole('table')).toHaveCount(0);
});

test('an unknown record is a 404', async ({ page }) => {
	await page.goto('/movies/doesnotexist000');
	await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
});
