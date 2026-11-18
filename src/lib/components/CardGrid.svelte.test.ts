import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getCollection, type CollectionDef } from '../collections.ts';
import CardGrid from './CardGrid.svelte';

const mtg = getCollection('mtg') as CollectionDef;
const movies = getCollection('movies') as CollectionDef;
const PNG =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('CardGrid', () => {
	it('renders lazy covers with the record title as alt text and the right shape', async () => {
		render(CardGrid, { def: mtg, items: [{ id: 'c1', name: 'Black Lotus', image: PNG }] });
		const img = page.getByRole('img', { name: 'Black Lotus' });
		await expect.element(img).toHaveAttribute('loading', 'lazy');
		await expect
			.element(page.getByTestId('cover-frame'))
			.toHaveAttribute('style', expect.stringContaining('aspect-ratio: 63 / 88'));
	});

	it('shows a placeholder when there is no cover', async () => {
		render(CardGrid, { def: movies, items: [{ id: 'm1', title: 'No Cover', cover: '' }] });
		await expect.element(page.getByTestId('cover-placeholder')).toBeInTheDocument();
		await expect.element(page.getByRole('img', { name: 'No Cover' })).not.toBeInTheDocument();
	});

	it('swaps in the placeholder when the cover fails to load', async () => {
		render(CardGrid, {
			def: movies,
			items: [{ id: 'm2', title: 'Broken', cover: '/definitely-missing-cover.png' }]
		});
		await expect.element(page.getByTestId('cover-placeholder')).toBeInTheDocument();
	});

	it('links each card to its record', async () => {
		render(CardGrid, { def: movies, items: [{ id: 'm3', title: 'Linked', cover: PNG }] });
		await expect
			.element(page.getByRole('link', { name: /Linked/ }))
			.toHaveAttribute('href', '/movies/m3');
	});
});
