import { describe, expect, it } from 'vitest';
import { getCollection, type CollectionDef } from '../collections.ts';
import { loadMetaOptions, type MetaSource } from './meta.ts';

function source(rows: { name: string; type: string }[]) {
	const calls: unknown[] = [];
	const pb: MetaSource = {
		collection: (name: string) => ({
			getFullList: async (opts: unknown) => {
				calls.push([name, opts]);
				return rows;
			}
		})
	};
	return { pb, calls };
}

const rows = [
	{ name: 'drama', type: 'genre' },
	{ name: '4k', type: 'definition' },
	{ name: 'go', type: 'tags' },
	{ name: 'in_progress', type: 'status' }
];

describe('loadMetaOptions', () => {
	it('groups names by the meta types the create form uses', async () => {
		const { pb } = source(rows);
		const movies = getCollection('movies') as CollectionDef;
		expect(await loadMetaOptions(pb, movies)).toEqual({
			genre: ['drama'],
			definition: ['4k'],
			status: ['in_progress']
		});
	});

	it('skips the request when the form has no meta fields', async () => {
		const { pb, calls } = source(rows);
		expect(await loadMetaOptions(pb, getCollection('github') as CollectionDef)).toEqual({});
		expect(calls).toEqual([]);
	});

	it('reads meta sorted by name', async () => {
		const { pb, calls } = source(rows);
		await loadMetaOptions(pb, getCollection('articles') as CollectionDef);
		expect(calls).toEqual([['meta', { sort: 'name', fields: 'name,type' }]]);
	});
});
