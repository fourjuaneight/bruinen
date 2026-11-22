import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, login, test } from './helpers.ts';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function noViolations(page: Page) {
	const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
	const summary = violations.map(
		(v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`
	);
	expect(summary).toEqual([]);
}

/**
 * Controls must be at least 44×44 CSS px. Links inside running text are exempt (WCAG 2.5.8).
 * A checkbox or file input wrapped in its label is measured by the label, since tapping the
 * label works it (the cover upload's file input is visually hidden inside a button-like label).
 */
async function smallTargets(page: Page) {
	return page.evaluate(() => {
		const selector =
			'button, input:not([type=hidden]), select, textarea, nav a, a.button, .cards a, main > ul a';
		const target = (el: HTMLElement) =>
			el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'file')
				? (el.closest('label') ?? el)
				: el;
		return [...document.querySelectorAll<HTMLElement>(selector)]
			.filter((el) => el.offsetParent !== null && !el.closest('dialog:not([open])'))
			.map((el) => ({ el, box: target(el).getBoundingClientRect() }))
			.filter(({ box }) => box.width < 44 || box.height < 44)
			.map(
				({ el, box }) =>
					`${el.tagName.toLowerCase()} "${el.textContent?.trim() || el.getAttribute('aria-label')}" ${Math.round(box.width)}×${Math.round(box.height)}`
			);
	});
}

for (const colorScheme of ['light', 'dark'] as const) {
	test.describe(`${colorScheme} scheme`, () => {
		test.use({ colorScheme });

		test('login page', async ({ page }) => {
			await page.goto('/login');
			await noViolations(page);
		});

		test.describe('signed in', () => {
			test.beforeEach(async ({ page }) => login(page));

			for (const path of [
				'/',
				'/movies?view=table',
				'/movies?view=cards',
				'/movies?page=999&view=table',
				'/books?q=zzzz',
				'/nope'
			]) {
				test(`page ${path}`, async ({ page }) => {
					await page.goto(path);
					await noViolations(page);
				});
			}

			test('record detail', async ({ page }) => {
				await page.goto('/books?view=table');
				await page.getByRole('link', { name: 'Nineteen Eighty-Four' }).click();
				await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
				await noViolations(page);
			});

			test('cover upload with an error', async ({ page }) => {
				await page.goto('/games?view=cards');
				await page
					.getByRole('link', { name: /Hollow Knight/ })
					.first()
					.click();
				await page.getByLabel('Replace cover').setInputFiles('tests/e2e/fixtures/cover.png');
				await expect(page.getByText('Choose a JPEG image.')).toBeVisible();
				await noViolations(page);
			});

			test('open create dialog with errors', async ({ page }) => {
				await page.goto('/articles');
				await page.getByRole('button', { name: 'Add article' }).click();
				await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
				await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
				await noViolations(page);
			});

			test('open edit dialog with errors', async ({ page }) => {
				await page.goto('/books?view=table');
				await page.getByRole('link', { name: 'Nineteen Eighty-Four' }).click();
				await page.getByRole('button', { name: 'Edit' }).click();
				const dialog = page.getByRole('dialog', { name: /^Edit / });
				await dialog.getByLabel('Title').fill('');
				await dialog.getByRole('button', { name: 'Save changes' }).click();
				await expect(dialog.getByRole('alert')).toBeVisible();
				await noViolations(page);
			});
		});
	});
}

test('the first Tab reaches the skip link', async ({ page, isMobile }) => {
	test.skip(isMobile, 'no Tab key on phones');
	await login(page);
	await page.goto('/movies');
	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
});

test('controls are at least 44px on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await login(page);
	for (const path of ['/', '/movies?view=table', '/movies?view=cards', '/login']) {
		await page.goto(path);
		expect(await smallTargets(page), path).toEqual([]);
	}
	await page.goto('/books');
	await page.getByRole('button', { name: 'Add book' }).click();
	expect(await smallTargets(page), 'create dialog').toEqual([]);
	await page.goto('/books?view=table');
	await page.getByRole('link', { name: 'Nineteen Eighty-Four' }).click();
	expect(await smallTargets(page), 'record detail').toEqual([]);
	await expect(page.getByLabel('Replace cover')).toBeAttached();
	await page.getByRole('button', { name: 'Edit' }).click();
	expect(await smallTargets(page), 'edit dialog').toEqual([]);
});
