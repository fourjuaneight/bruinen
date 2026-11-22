import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getCollection, type CollectionDef } from '../collections.ts';
import RecordList from './RecordList.svelte';

const articles = getCollection('articles') as CollectionDef;

describe('RecordList', () => {
	it('shows each record as one link row: title, creator · year, flags then tags', async () => {
		render(RecordList, {
			def: articles,
			items: [
				{
					id: 'a1',
					title: 'Choose Boring Technology',
					creator: 'Dan McKinley',
					year: 2015,
					favorite: true,
					expand: { tags: [{ name: 'engineering' }] }
				}
			]
		});
		const row = page.getByRole('link', { name: /Choose Boring Technology/ });
		await expect.element(row).toHaveAttribute('href', '/articles/a1');
		await expect.element(row.getByText('Dan McKinley · 2015')).toBeInTheDocument();
		const chips = row.getByRole('listitem');
		await expect.element(chips.nth(0)).toHaveTextContent('Favorite');
		await expect.element(chips.nth(1)).toHaveTextContent('engineering');
	});

	it('leaves out empty values', async () => {
		const { container } = await render(RecordList, {
			def: articles,
			items: [{ id: 'a2', title: 'Bare', year: 0 }]
		});
		const row = container.querySelector('a');
		expect(row?.querySelector('ul')).toBeNull();
		expect(row?.textContent?.trim()).toBe('Bare');
	});
});
