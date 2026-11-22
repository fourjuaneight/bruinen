import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Cover from './Cover.svelte';

const PNG =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('Cover', () => {
	it('fetches an eager cover (the record page) at high priority', async () => {
		render(Cover, { src: PNG, title: 'Dune', alt: 'Dune', aspect: '2 / 3', eager: true });
		const img = page.getByRole('img', { name: 'Dune' });
		await expect.element(img).toHaveAttribute('fetchpriority', 'high');
		await expect.element(img).toHaveAttribute('loading', 'eager');
	});

	it('lazy-loads card covers at the default priority', async () => {
		render(Cover, { src: PNG, title: 'Dune', alt: 'Dune', aspect: '2 / 3' });
		const img = page.getByRole('img', { name: 'Dune' });
		await expect.element(img).toHaveAttribute('loading', 'lazy');
		await expect.element(img).not.toHaveAttribute('fetchpriority');
	});

	it('shows the first letter of the title when there is no cover, hidden from screen readers', async () => {
		const { container } = await render(Cover, { src: '', title: 'dune', alt: '', aspect: '2 / 3' });
		const placeholder = container.querySelector('[data-testid="cover-placeholder"]');
		expect(placeholder?.textContent?.trim()).toBe('D');
		expect(placeholder?.getAttribute('aria-hidden')).toBe('true');
	});
});
