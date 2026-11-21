import PocketBase from 'pocketbase';
import { describe, expect, it } from 'vitest';
import { getCollection, type CollectionDef } from '../collections.ts';
import { buildListOptions, parseListQuery, PER_PAGE } from './query.ts';

const pb = new PocketBase('http://x');
const filter = pb.filter.bind(pb);
const movies = getCollection('movies') as CollectionDef;
const articles = getCollection('articles') as CollectionDef;
const github = getCollection('github') as CollectionDef;
const parse = (qs: string, def = movies) => parseListQuery(new URL(`http://app/x?${qs}`), def);

describe('parseListQuery', () => {
	it('fills defaults for an empty query', () => {
		expect(parse('')).toEqual({ q: '', sort: '-@rowid', page: 1, view: null });
	});

	it.each(['abc', '-3', '0', '1.5'])('clamps page=%s to 1', (page) => {
		expect(parse(`page=${page}`).page).toBe(1);
	});

	it('keeps a large page number for the loader to handle', () => {
		expect(parse('page=999').page).toBe(999);
	});

	it.each(['year', '-year', 'title'])('keeps allowed sort %s', (sort) => {
		expect(parse(`sort=${sort}`).sort).toBe(sort);
	});

	it.each(['password', '--year', 'genre', '-'])('rejects sort %s', (sort) => {
		expect(parse(`sort=${encodeURIComponent(sort)}`).sort).toBe('-@rowid');
	});

	it('keeps view=cards only for collections with images', () => {
		expect(parse('view=cards').view).toBe('cards');
		expect(parse('view=table').view).toBe('table');
		expect(parse('view=x').view).toBeNull();
		expect(parse('view=cards', articles).view).toBeNull();
	});

	it('trims the search text', () => {
		expect(parse(`q=${encodeURIComponent("  O'Brien  ")}`).q).toBe("O'Brien");
	});

	it('pages by 30', () => {
		expect(PER_PAGE).toBe(30);
	});
});

describe('buildListOptions', () => {
	it('searches every search field with escaped text', () => {
		const opts = buildListOptions(movies, parse("q=O'Brien"), filter);
		expect(opts.filter).toBe(
			pb.filter('title ~ {:q} || director ~ {:q} || barcode ~ {:q} || genre.name ?~ {:q}', {
				q: "O'Brien"
			})
		);
	});

	it('keeps filter operators inside the quoted search literal', () => {
		const opts = buildListOptions(
			github,
			parse(`q=${encodeURIComponent('|| id != ""')}`, github),
			filter
		);
		const literal = pb.filter('{:q}', { q: '|| id != ""' });
		expect(opts.filter?.startsWith(`name ~ ${literal} ||`)).toBe(true);
	});

	it('matches multi-value relations when any value matches', () => {
		const articles = getCollection('articles') as CollectionDef;
		const opts = buildListOptions(
			articles,
			parseListQuery(new URL('http://app/x?q=go'), articles),
			filter
		);
		// Plain ~ on a multi relation means every tag must match in PocketBase; ?~ means any.
		expect(opts.filter).toBe(
			pb.filter('title ~ {:q} || creator ~ {:q} || tags.name ?~ {:q}', { q: 'go' })
		);
	});

	it('omits the filter when there is no search text', () => {
		expect(buildListOptions(movies, parse(''), filter).filter).toBeUndefined();
	});

	it('passes sort and expand through', () => {
		expect(buildListOptions(movies, parse('sort=-year'), filter)).toMatchObject({
			sort: '-year',
			expand: 'genre,definition,status'
		});
		expect(buildListOptions(github, parse('', github), filter).expand).toBeUndefined();
	});
});
