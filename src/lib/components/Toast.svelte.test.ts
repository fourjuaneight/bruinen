import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Toast from './Toast.svelte';

describe('Toast', () => {
	it('names the record in its View link', async () => {
		render(Toast, { message: 'Added Dune', href: '/books/b1', linkLabel: 'Dune' });
		await expect
			.element(page.getByRole('link', { name: 'View Dune' }))
			.toHaveAttribute('href', '/books/b1');
	});

	it('can be dismissed', async () => {
		render(Toast, { message: 'Saved changes' });
		await page.getByRole('button', { name: 'Dismiss' }).click();
		await expect.element(page.getByRole('status')).not.toBeInTheDocument();
	});
});
