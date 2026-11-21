import { ADMIN, expect, hits, login, mock, test } from './helpers.ts';

const REFRESH = 'POST /api/collections/_superusers/auth-refresh';

test('browsing with a fresh session makes no refresh calls', async ({ page }) => {
	await login(page);
	await page.goto('/movies');
	await page.getByRole('link', { name: 'Books' }).first().click();
	await expect(page).toHaveURL('/books');
	expect(await hits(REFRESH)).toBe(0);
});

test('a revoked session offers to sign in again', async ({ page }) => {
	await login(page, '/movies');
	await mock('revoke');
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Session expired' })).toBeVisible();
	await page.getByRole('link', { name: 'Sign in again' }).click();
	await expect(page).toHaveURL('/login?next=%2Fmovies');
});

test('logged-out visitors are sent to login with a return path', async ({ page }) => {
	await page.goto('/movies');
	await expect(page).toHaveURL('/login?next=%2Fmovies');
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('a wrong password shows an error', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Email').fill(ADMIN.email);
	await page.getByLabel('Password').fill('nope');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('alert')).toHaveText('Wrong email or password');
	await expect(page.getByLabel('Email')).toHaveValue(ADMIN.email);
});

test('signing in returns to the requested page', async ({ page }) => {
	await login(page, '/movies');
	await expect(page).toHaveURL('/movies');
});

test('an MFA account gets a clear message', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Email').fill('mfa@test.local');
	await page.getByLabel('Password').fill('whatever');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('alert')).toHaveText(
		'This account requires MFA, which Bruinen does not support yet'
	);
});

test('a garbage session cookie sends you to login instead of erroring', async ({
	page,
	context
}) => {
	await context.addCookies([{ name: 'pb_auth', value: 'garbage', url: 'http://localhost:4173' }]);
	await page.goto('/');
	await expect(page).toHaveURL(/\/login/);
});

test('logging out ends the session', async ({ page }) => {
	await login(page);
	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page).toHaveURL(/\/login/);
	await page.goto('/');
	await expect(page).toHaveURL(/\/login/);
});
