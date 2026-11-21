import { expect, login, test } from './helpers.ts';
import type { Page } from '@playwright/test';

test.beforeEach(async ({ page }) => login(page));

async function openEdit(page: Page, list: string, title: RegExp) {
	await page.goto(list);
	await page.getByRole('link', { name: title }).first().click();
	await page.getByRole('button', { name: 'Edit' }).click();
	return page.getByRole('dialog', { name: /^Edit / });
}

test('edits a book’s status and favorite flag', async ({ page }) => {
	const dialog = await openEdit(page, '/books?view=cards', /Dune/);
	await expect(dialog.getByLabel('Title')).toHaveValue('Dune');
	await expect(dialog.getByLabel('Status')).toHaveValue('not_started');
	await expect(dialog.getByLabel('Favorite')).toBeChecked();

	await dialog.getByLabel('Status').selectOption('completed');
	await dialog.getByLabel('Favorite').uncheck();
	await dialog.getByRole('button', { name: 'Save changes' }).click();

	await expect(dialog).toBeHidden();
	await expect(page.getByRole('status')).toContainText('Saved changes');
	await expect(page.getByText('Completed', { exact: true })).toBeVisible();
	await expect(page.locator('dl').getByText('Favorite', { exact: true })).toHaveCount(0);
});

test('clears an optional field', async ({ page }) => {
	const dialog = await openEdit(page, '/books?view=cards', /Dune/);
	await dialog.getByLabel('Year').fill('');
	await dialog.getByRole('button', { name: 'Save changes' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByText('1965', { exact: true })).toHaveCount(0);
});

test('keeps the dialog open with an error when a required field is emptied', async ({ page }) => {
	const dialog = await openEdit(page, '/books?view=cards', /Dune/);
	await dialog.getByLabel('Title').fill('');
	await dialog.getByRole('button', { name: 'Save changes' }).click();
	await expect(dialog.getByLabel('Title')).toHaveAttribute('aria-invalid', 'true');
	await expect(dialog.getByText('Required')).toBeVisible();
	await expect(dialog).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dune');
});

test('edits tags, which Rivendell stores as meta IDs', async ({ page }) => {
	const dialog = await openEdit(page, '/articles', /How Postgres Handles Transactions/);
	await dialog.getByLabel('Tags').selectOption(['go', 'tech']);
	await dialog.getByRole('button', { name: 'Save changes' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByText('go, tech', { exact: true })).toBeVisible();
});

test('says so when nothing changed', async ({ page }) => {
	const dialog = await openEdit(page, '/books?view=cards', /Dune/);
	await dialog.getByRole('button', { name: 'Save changes' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByRole('status')).toContainText('No changes');
});
