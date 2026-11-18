import { describe, expect, it } from 'vitest';
import { getCollection, type CollectionDef } from './collections.ts';
import { listHref, nextSort, sortState, type ListQuery } from './list.ts';

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
