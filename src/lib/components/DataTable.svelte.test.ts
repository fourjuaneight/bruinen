import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getCollection, type CollectionDef } from '../collections.ts';
import DataTable from './DataTable.svelte';

const movies = getCollection('movies') as CollectionDef;
const items = [
	{
		id: 'm1',
		title: 'Blade Runner',
		director: 'Ridley Scott',
		year: 1982,
		genre: 'g1',
		expand: { genre: { id: 'g1', name: 'drama' } }
	}
];

describe('DataTable', () => {
	it('marks the sorted column and links to the flipped sort', async () => {
		render(DataTable, { def: movies, items, query: { q: '', sort: '-year', page: 1, view: null } });
		const year = page.getByRole('columnheader', { name: 'Year' });
		await expect.element(year).toHaveAttribute('aria-sort', 'descending');
		await expect
			.element(year.getByRole('link'))
			.toHaveAttribute('href', expect.stringContaining('sort=year'));
	});

	it('marks unsorted sortable columns as none', async () => {
		render(DataTable, { def: movies, items, query: { q: '', sort: '-year', page: 1, view: null } });
		await expect
			.element(page.getByRole('columnheader', { name: 'Title' }))
			.toHaveAttribute('aria-sort', 'none');
	});

	it('shows meta names and links the title to the record', async () => {
		render(DataTable, {
			def: movies,
			items,
			query: { q: '', sort: '-@rowid', page: 1, view: null }
		});
		await expect.element(page.getByRole('cell', { name: /drama/ })).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Blade Runner' }))
			.toHaveAttribute('href', '/movies/m1');
	});

	it('names the sort in its caption', async () => {
		render(DataTable, { def: movies, items, query: { q: '', sort: '-year', page: 1, view: null } });
		await expect
			.element(page.getByRole('table', { name: 'Movies, sorted by year, newest first' }))
			.toBeInTheDocument();
	});

	it('merges the flags into one column of badges, instead of Yes', async () => {
		const articles = getCollection('articles') as CollectionDef;
		render(DataTable, {
			def: articles,
			items: [{ id: 'a1', title: 'Worse Is Better', favorite: true, dead: true }],
			query: { q: '', sort: '-@rowid', page: 1, view: null }
		});
		await expect.element(page.getByRole('columnheader', { name: 'Flags' })).toBeInTheDocument();
		await expect
			.element(page.getByRole('columnheader', { name: 'Favorite' }))
			.not.toBeInTheDocument();
		await expect
			.element(page.getByRole('cell', { name: 'Favorite Dead link' }))
			.toBeInTheDocument();
		await expect.element(page.getByText('Yes')).not.toBeInTheDocument();
	});

	it('shows tags as separate chips', async () => {
		const articles = getCollection('articles') as CollectionDef;
		render(DataTable, {
			def: articles,
			items: [{ id: 'a2', title: 'T', expand: { tags: [{ name: 'web' }, { name: 'history' }] } }],
			query: { q: '', sort: '-@rowid', page: 1, view: null }
		});
		const cell = page.getByRole('cell', { name: 'web history' });
		await expect.element(cell.getByRole('listitem')).toHaveLength(2);
	});
});
