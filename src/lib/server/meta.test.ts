import { describe, expect, it } from 'vitest';
import { getCollection, type CollectionDef } from '../collections.ts';
import { loadMetaOptions, resolveMetaIds, type MetaSource } from './meta.ts';

function source(rows: { id?: string; name: string; type: string }[]) {
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

	it('lists a name once even when Rivendell has duplicate meta rows', async () => {
		// The live data has two genre rows named "art"; a keyed list would throw on the duplicate.
		const { pb } = source([...rows, { name: 'drama', type: 'genre' }]);
		const movies = getCollection('movies') as CollectionDef;
		expect((await loadMetaOptions(pb, movies)).genre).toEqual(['drama']);
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

describe('resolveMetaIds', () => {
	const books = getCollection('books') as CollectionDef;
	const articles = getCollection('articles') as CollectionDef;
	// Rivendell's live meta has duplicate names; m1 and m9 are both the "art" genre.
	const meta = [
		{ id: 'm1', name: 'art', type: 'genre' },
		{ id: 'm2', name: 'fiction', type: 'genre' },
		{ id: 'm3', name: 'finished', type: 'status' },
		{ id: 'm9', name: 'art', type: 'genre' },
		{ id: 't1', name: 'go', type: 'tags' },
		{ id: 't2', name: 'tech', type: 'tags' }
	];
	const book = (genre?: { id: string; name: string }) => ({
		id: 'b1',
		genre: genre?.id ?? '',
		expand: genre ? { genre } : {}
	});

	it('swaps meta names for IDs, taking the first row for a new name', async () => {
		const { pb, calls } = source(meta);
		const out = await resolveMetaIds(pb, books, { genre: 'art', status: 'finished' }, book());
		expect(out).toEqual({ data: { genre: 'm1', status: 'm3' }, errors: {} });
		expect(calls).toEqual([['meta', { sort: '@rowid', fields: 'id,name,type' }]]);
	});

	it('keeps the duplicate row the record already points at', async () => {
		const { pb } = source(meta);
		const out = await resolveMetaIds(
			pb,
			articles,
			{ tags: ['go', 'tech'] },
			{ tags: ['t2'], expand: { tags: [{ id: 't2', name: 'tech' }] } }
		);
		expect(out.data.tags).toEqual(['t1', 't2']);
		const kept = await resolveMetaIds(pb, books, { genre: 'art' }, book({ id: 'm9', name: 'art' }));
		expect(kept.data.genre).toBe('m9');
	});

	it('keeps every row the record links for a duplicated tag name', async () => {
		const { pb } = source([...meta, { id: 't7', name: 'go', type: 'tags' }]);
		const current = {
			tags: ['t1', 't7'],
			expand: {
				tags: [
					{ id: 't1', name: 'go' },
					{ id: 't7', name: 'go' }
				]
			}
		};
		const out = await resolveMetaIds(pb, articles, { tags: ['go', 'tech'] }, current);
		expect(out.data.tags).toEqual(['t1', 't7', 't2']);
	});

	it('passes cleared relations and other fields through', async () => {
		const { pb } = source(meta);
		const out = await resolveMetaIds(pb, books, { genre: '', title: 'Dune' }, book());
		expect(out.data).toEqual({ genre: '', title: 'Dune' });
	});

	it('reports names that have no meta row', async () => {
		const { pb } = source(meta);
		const out = await resolveMetaIds(pb, books, { genre: 'nope' }, book());
		expect(out.errors).toEqual({ genre: 'Unknown genre: nope' });
		const tags = await resolveMetaIds(pb, articles, { tags: ['go', 'x', 'y'] }, {});
		expect(tags.errors).toEqual({ tags: 'Unknown tags: x, y' });
	});

	it('skips the request when no relation changed', async () => {
		const { pb, calls } = source(meta);
		expect(await resolveMetaIds(pb, books, { title: 'Dune' }, book())).toEqual({
			data: { title: 'Dune' },
			errors: {}
		});
		expect(calls).toEqual([]);
	});
});
