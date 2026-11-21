import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { MAX_COVER_BYTES } from '../../src/lib/covers.ts';
import { cachedUrls, expect, login, MOCK_PB, test } from './helpers.ts';
import { B2_COVER } from './mock-pb/seed.ts';

const BLUE = 'tests/e2e/fixtures/cover-60x40.jpeg';
const PNG = 'tests/e2e/fixtures/cover.png';

test.beforeEach(async ({ page }) => login(page));

async function open(page: Page, list: string, title: RegExp) {
	await page.goto(list);
	await page.getByRole('link', { name: title }).first().click();
	await page.waitForURL(/\/rec\w+$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
}

const img = (page: Page) => page.getByTestId('cover-frame').locator('img');
const width = (page: Page) => img(page).evaluate((i: HTMLImageElement) => i.naturalWidth);
const coverInput = (page: Page) => page.getByLabel(/(Replace|Add) cover/);
const b2Files = async () => (await (await fetch(`${MOCK_PB}/__mock/b2`)).json()) as string[];

test('replaces a cover in place', async ({ page }) => {
	await open(page, '/games?view=cards', /Hollow Knight/);
	const url = B2_COVER('Games/Hollow_Knight.jpeg');
	await expect(img(page)).toHaveAttribute('src', url);
	await expect.poll(() => width(page)).toBe(40);
	await expect.poll(() => cachedUrls(page, 'bruinen-images')).toContain(url);

	await coverInput(page).setInputFiles(BLUE);

	await expect(page.getByRole('status')).toContainText('Cover updated');
	await expect(img(page)).toHaveAttribute('src', url);
	await expect.poll(() => width(page)).toBe(60);
	await page.reload();
	await expect.poll(() => width(page)).toBe(60);
});

test('adds a cover to a record without one', async ({ page }) => {
	await open(page, '/books?view=cards', /Dune/);
	await expect(page.getByTestId('cover-placeholder')).toBeVisible();

	await page.getByLabel('Add cover').setInputFiles(BLUE);

	await expect(page.getByRole('status')).toContainText('Cover updated');
	await expect(img(page)).toHaveAttribute('src', B2_COVER('Books/Dune.jpeg'));
	await expect.poll(() => width(page)).toBe(60);
	await expect(page.getByLabel('Replace cover')).toBeAttached();
});

test('gives a record its own file when it shares one', async ({ page }) => {
	await open(page, '/books?view=cards', /Nineteen Eighty-Four/);
	const id = new URL(page.url()).pathname.split('/').pop();

	await coverInput(page).setInputFiles(BLUE);

	await expect(page.getByRole('status')).toContainText('Cover updated');
	await expect(img(page)).toHaveAttribute('src', B2_COVER(`Books/Nineteen_Eighty-Four-${id}.jpeg`));
	await open(page, '/books?view=cards', /Kindred/);
	await expect(img(page)).toHaveAttribute('src', B2_COVER('Books/Nineteen_Eighty-Four.jpeg'));
	await expect.poll(() => width(page)).toBe(40);
});

test('refuses a PNG labelled as JPEG', async ({ page }) => {
	await open(page, '/games?view=cards', /Hollow Knight/);
	const before = await b2Files();

	await coverInput(page).setInputFiles({
		name: 'x.jpeg',
		mimeType: 'image/jpeg',
		buffer: readFileSync(PNG)
	});

	await expect(page.getByText('Choose a JPEG image.')).toBeVisible();
	await expect(page.getByRole('dialog', { name: /^Edit / })).toBeHidden();
	await expect.poll(() => width(page)).toBe(40);
	expect(await b2Files()).toEqual(before);
});

test('refuses a PNG and an oversized file in the browser', async ({ page }) => {
	await open(page, '/games?view=cards', /Hollow Knight/);
	const before = await b2Files();

	await coverInput(page).setInputFiles(PNG);
	await expect(page.getByText('Choose a JPEG image.')).toBeVisible();

	await coverInput(page).setInputFiles({
		name: 'big.jpeg',
		mimeType: 'image/jpeg',
		buffer: Buffer.alloc(MAX_COVER_BYTES + 1, 0xff)
	});
	await expect(page.getByText('The image must be 10 MB or smaller.')).toBeVisible();
	expect(await b2Files()).toEqual(before);
});

test('shows no cover control where there is no cover field', async ({ page }) => {
	for (const [list, title] of [
		['/read_later', /Later Read/],
		['/mtg', /Black Lotus/]
	] as const) {
		await open(page, list, title);
		await expect(coverInput(page)).toHaveCount(0);
	}
});
