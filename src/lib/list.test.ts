import { describe, expect, it } from 'vitest';
import { getCollection, type CollectionDef } from './collections.ts';
import { listHref, nextSort, sortCaption, sortOptions, sortState, type ListQuery } from './list.ts';

const movies = getCollection('movies') as CollectionDef;
const base: ListQuery = { q: '', sort: '-@rowid', page: 1, view: null };

describe('listHref', () => {
	it('omits defaults', () => {
		expect(listHref(movies, base)).toBe('/movies');
	});

	it('keeps search, sort, page and view', () => {
		expect(listHref(movies, { q: 'a b', sort: 'year', page: 2, view: 'cards' })).toBe(
			'/movies?q=a+b&sort=year&page=2&view=cards'
		);
	});

	it('applies overrides and drops page when it returns to 1', () => {
		expect(listHref(movies, { ...base, page: 3 }, { page: 1, view: 'table' })).toBe(
			'/movies?view=table'
		);
	});
});

describe('nextSort', () => {
	it('sorts ascending first, then flips', () => {
		expect(nextSort('-@rowid', 'year')).toBe('year');
		expect(nextSort('year', 'year')).toBe('-year');
		expect(nextSort('-year', 'year')).toBe('year');
	});
});

describe('sortState', () => {
	it('reports the aria-sort value for a column', () => {
		expect(sortState('year', 'year')).toBe('ascending');
		expect(sortState('-year', 'year')).toBe('descending');
		expect(sortState('-@rowid', 'year')).toBe('none');
	});
});

describe('sortOptions', () => {
	it('starts with the default order, then each sortable field both ways', () => {
		const articles = getCollection('articles') as CollectionDef;
		expect(sortOptions(articles).map((o) => o.label)).toEqual([
			'Recently added',
			'Title (A–Z)',
			'Title (Z–A)',
			'Creator (A–Z)',
			'Creator (Z–A)',
			'Year (oldest first)',
			'Year (newest first)'
		]);
	});

	it('never lists the default sort twice', () => {
		const records = getCollection('records') as CollectionDef;
		const values = sortOptions(records).map((o) => o.value);
		expect(values.filter((v) => v === '-start')).toHaveLength(1);
	});
});

describe('sortCaption', () => {
	const articles = getCollection('articles') as CollectionDef;

	it('names the sorted field and its direction', () => {
		expect(sortCaption(articles, '-year')).toBe('Articles, sorted by year, newest first');
		expect(sortCaption(articles, 'title')).toBe('Articles, sorted by title, A–Z');
	});

	it('describes the default order in words', () => {
		expect(sortCaption(articles, '-@rowid')).toBe('Articles, most recently added first');
	});
});
