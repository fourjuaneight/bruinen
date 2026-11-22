import { expect, login, mock, test } from './helpers.ts';

test.beforeEach(async ({ page }) => login(page));

test('creates a book with meta names and links to it', async ({ page }) => {
	await page.goto('/books');
	await page.getByRole('button', { name: 'Add book' }).click();
	const dialog = page.getByRole('dialog', { name: 'Add book' });
	await dialog.getByLabel('Title').fill('The Left Hand of Darkness');
	await dialog.getByLabel('Author').fill('Ursula K. Le Guin');
	await dialog.getByLabel('Genre').selectOption('rock');
	await dialog.getByLabel('Status').selectOption('in_progress');
	await dialog.getByRole('button', { name: 'Save' }).click();

	await expect(dialog).toBeHidden();
	const toast = page.getByRole('status').filter({ hasText: 'Added' });
	await expect(toast).toContainText('The Left Hand of Darkness');
	await toast.getByRole('link', { name: 'View The Left Hand of Darkness' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Left Hand of Darkness');
	await expect(page.locator('dl').getByText('Rock', { exact: true })).toBeVisible();
	await expect(page.getByText('In Progress', { exact: true })).toBeVisible();
});

test('shows field errors and keeps the dialog open', async ({ page }) => {
	await page.goto('/books');
	await page.getByRole('button', { name: 'Add book' }).click();
	const dialog = page.getByRole('dialog', { name: 'Add book' });
	await dialog.getByLabel('Title').fill('Only a title');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog.getByLabel('Author')).toHaveAttribute('aria-invalid', 'true');
	await expect(dialog.getByText('Required')).toBeVisible();
	await expect(dialog.getByLabel('Title')).toHaveValue('Only a title');
	await expect(dialog).toBeVisible();
});

test('reports a record saved without enrichment', async ({ page }) => {
	await page.goto('/movies?view=table');
	await page.getByRole('button', { name: 'Add movie' }).click();
	const dialog = page.getByRole('dialog', { name: 'Add movie' });
	await dialog.getByLabel('Title').fill('ENRICHFAIL test');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status')).toContainText(
		"Saved, but Rivendell couldn't fetch its metadata"
	);
});

test('shows a uniqueness error on the field', async ({ page }) => {
	await page.goto('/github');
	await page.getByRole('button', { name: 'Add repo' }).click();
	const dialog = page.getByRole('dialog', { name: 'Add repo' });
	await dialog.getByLabel('Repository URL').fill('https://github.com/pocketbase/pocketbase');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog.getByText('Value must be unique.')).toBeVisible();
	await expect(dialog.getByLabel('Repository URL')).toHaveAttribute('aria-invalid', 'true');
});

test('a slow create shows the archiving state', async ({ page }) => {
	await mock('delay', { ms: 1500 });
	await page.goto('/articles');
	await page.getByRole('button', { name: 'Add article' }).click();
	const dialog = page.getByRole('dialog', { name: 'Add article' });
	await dialog.getByLabel('Title').fill('Slow one');
	await dialog.getByLabel('Creator').fill('Someone');
	await dialog.getByLabel('URL').fill('https://example.com/slow');
	await dialog.getByLabel('Tags').selectOption(['go']);
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(
		dialog.getByRole('button', { name: 'Archiving… this can take a few minutes' })
	).toBeDisabled();
	await expect(page.getByRole('status').filter({ hasText: 'Added' })).toContainText('Slow one');
});

test('Esc closes the dialog and returns focus to the opener', async ({ page }) => {
	await page.goto('/movies');
	const opener = page.getByRole('button', { name: 'Add movie' });
	await opener.click();
	await expect(page.getByRole('dialog', { name: 'Add movie' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Add movie' })).toBeHidden();
	await expect(opener).toBeFocused();
});

test('clicking outside the dialog closes it', async ({ page }) => {
	await page.goto('/movies');
	const opener = page.getByRole('button', { name: 'Add movie' });
	await opener.click();
	const dialog = page.getByRole('dialog', { name: 'Add movie' });
	await expect(dialog).toBeVisible();

	// A click inside leaves it open.
	await dialog.getByLabel('Title').click();
	await expect(dialog).toBeVisible();

	// Dragging a selection from an input out onto the backdrop leaves it open too.
	const title = await dialog.getByLabel('Title').boundingBox();
	await page.mouse.move(title!.x + 5, title!.y + 5);
	await page.mouse.down();
	await page.mouse.move(2, 2);
	await page.mouse.up();
	await expect(dialog).toBeVisible();

	await page.mouse.click(2, 2);
	await expect(dialog).toBeHidden();
	await expect(opener).toBeFocused();
});

test('Cancel closes the dialog', async ({ page }) => {
	await page.goto('/movies');
	await page.getByRole('button', { name: 'Add movie' }).click();
	const dialog = page.getByRole('dialog', { name: 'Add movie' });
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(dialog).toBeHidden();
});

test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('the New button opens the dialog, and errors come back in it', async ({ page }) => {
		await page.goto('/books');
		await page.getByRole('button', { name: 'Add book' }).click();
		const dialog = page.getByRole('dialog', { name: 'Add book' });
		await expect(dialog).toBeVisible();
		await dialog.getByLabel('Title').fill('Only a title');
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(dialog.getByText('Required')).toBeVisible();
		await expect(dialog.getByLabel('Title')).toHaveValue('Only a title');
	});
});
