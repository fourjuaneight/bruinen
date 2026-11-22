import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getCollection, type CollectionDef } from '../collections.ts';
import CardGrid from './CardGrid.svelte';

const mtg = getCollection('mtg') as CollectionDef;
const movies = getCollection('movies') as CollectionDef;
const PNG =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const shows = getCollection('shows') as CollectionDef;
const games = getCollection('games') as CollectionDef;
const books = getCollection('books') as CollectionDef;

describe('CardGrid', () => {
	it('shows the season on show cards', async () => {
		render(CardGrid, {
			def: shows,
			items: [{ id: 's1', title: 'Severance', season: 2, cover: PNG }]
		});
		const card = page.getByRole('link', { name: /Severance/ });
		await expect.element(card.getByText('Season 2', { exact: true })).toBeInTheDocument();
	});

	it('shows the platform in uppercase on game cards', async () => {
		render(CardGrid, {
			def: games,
			items: [
				{
					id: 'g1',
					title: 'Hollow Knight',
					platform: 'p1',
					expand: { platform: { name: 'pc' } },
					cover: PNG
				}
			]
		});
		const card = page.getByRole('link', { name: /Hollow Knight/ });
		await expect.element(card.getByText('PC', { exact: true })).toBeInTheDocument();
	});

	it('renders lazy, decorative covers in the right shape, since the title names the link', async () => {
		const { container } = await render(CardGrid, {
			def: mtg,
			items: [{ id: 'c1', name: 'Black Lotus', image: PNG }]
		});
		const img = container.querySelector('img');
		expect(img?.getAttribute('alt')).toBe('');
		expect(img?.getAttribute('loading')).toBe('lazy');
		await expect
			.element(page.getByTestId('cover-frame'))
			.toHaveAttribute('style', expect.stringContaining('aspect-ratio: 63 / 88'));
	});

	it('shows the creator and year, the status chip and a heart for favorites', async () => {
		render(CardGrid, {
			def: books,
			items: [
				{
					id: 'b1',
					title: 'Dune',
					author: 'Frank Herbert',
					year: 1965,
					favorite: true,
					cover: PNG,
					expand: { status: { name: 'in_progress' } }
				}
			]
		});
		const card = page.getByRole('link', { name: /Dune/ });
		await expect.element(card.getByText('Frank Herbert · 1965')).toBeInTheDocument();
		await expect.element(card.getByText('In Progress')).toBeInTheDocument();
		await expect.element(card.getByText('Favorite')).toBeInTheDocument();
	});

	it('shows a placeholder when there is no cover', async () => {
		render(CardGrid, { def: movies, items: [{ id: 'm1', title: 'No Cover', cover: '' }] });
		await expect.element(page.getByTestId('cover-placeholder')).toBeInTheDocument();
		await expect.element(page.getByRole('img')).not.toBeInTheDocument();
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
