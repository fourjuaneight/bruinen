import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Cover from './Cover.svelte';

const PNG =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('Cover', () => {
	it('fetches an eager cover (the record page) at high priority', async () => {
		render(Cover, { src: PNG, alt: 'Dune', aspect: '2 / 3', eager: true });
		const img = page.getByRole('img', { name: 'Dune' });
		await expect.element(img).toHaveAttribute('fetchpriority', 'high');
		await expect.element(img).toHaveAttribute('loading', 'eager');
	});

	it('lazy-loads card covers at the default priority', async () => {
		render(Cover, { src: PNG, alt: 'Dune', aspect: '2 / 3' });
		const img = page.getByRole('img', { name: 'Dune' });
		await expect.element(img).toHaveAttribute('loading', 'lazy');
		await expect.element(img).not.toHaveAttribute('fetchpriority');
	});
});
