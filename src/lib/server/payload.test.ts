import { ClientResponseError } from 'pocketbase';
import { describe, expect, it } from 'vitest';
import { getCollection, type CollectionDef } from '../collections.ts';
import { buildPayload, buildUpdate, formValues, mapPbError } from './payload.ts';

const books = getCollection('books') as CollectionDef;
const articles = getCollection('articles') as CollectionDef;
const records = getCollection('records') as CollectionDef;

function form(entries: [string, string][]) {
	const fd = new FormData();
	for (const [k, v] of entries) fd.append(k, v);
	return fd;
}

describe('buildPayload', () => {
	it('sends meta names as given and drops empty optional fields', () => {
		const out = buildPayload(
			books,
			form([
				['title', ' Dune '],
				['author', 'Frank Herbert'],
				['isbn', ''],
				['genre', 'fiction']
			])
		);
		expect(out).toEqual({
			data: { title: 'Dune', author: 'Frank Herbert', genre: 'fiction' },
			errors: {}
		});
	});

	it('flags missing required fields', () => {
		expect(buildPayload(books, form([['title', 'Dune']])).errors).toEqual({ author: 'Required' });
	});

	it('parses numbers and rejects non-numbers', () => {
		const base: [string, string][] = [
			['title', 'Dune'],
			['author', 'Frank Herbert']
		];
		expect(buildPayload(books, form([...base, ['year', 'abc']])).errors.year).toBe(
			'Must be a number'
		);
		expect(buildPayload(books, form([...base, ['year', '1999']])).data.year).toBe(1999);
	});

	it('limits tags to five', () => {
		const base: [string, string][] = [
			['title', 'T'],
			['creator', 'C'],
			['url', 'https://x.test']
		];
		const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((t): [string, string] => ['tags', t]);
		expect(buildPayload(articles, form([...base, ...six])).errors.tags).toBe('Up to 5 tags');
		expect(
			buildPayload(articles, form([...base, ['tags', 'go'], ['tags', 'tech']])).data.tags
		).toEqual(['go', 'tech']);
	});

	it('requires at least one tag where tags are required', () => {
		const out = buildPayload(
			articles,
			form([
				['title', 'T'],
				['creator', 'C'],
				['url', 'https://x.test']
			])
		);
		expect(out.errors.tags).toBe('Required');
	});

	it('splits a comma-separated stack and formats dates for PocketBase', () => {
		const out = buildPayload(
			records,
			form([
				['company', 'Acme'],
				['stack', 'Go, Postgres, '],
				['start', '2022-01-01']
			])
		);
		expect(out.data).toEqual({
			company: 'Acme',
			stack: ['Go', 'Postgres'],
			start: '2022-01-01 00:00:00.000Z'
		});
	});
});

describe('buildUpdate', () => {
	const book = {
		id: 'b1',
		title: 'Dune',
		author: 'Frank Herbert',
		isbn: '',
		genre: 'g1',
		status: 's1',
		year: 1965,
		comments: '',
		favorite: true,
		expand: { genre: { id: 'g1', name: 'fiction' }, status: { id: 's1', name: 'reading' } }
	};
	const unchanged: [string, string][] = [
		['title', 'Dune'],
		['author', 'Frank Herbert'],
		['isbn', ''],
		['genre', 'fiction'],
		['status', 'reading'],
		['year', '1965'],
		['comments', ''],
		['favorite', 'on']
	];
	const edited = (name: string, value: string | null) =>
		form([
			...unchanged.filter(([k]) => k !== name),
			...(value === null ? [] : [[name, value] as [string, string]])
		]);

	it('sends nothing when nothing changed', () => {
		expect(buildUpdate(books, form(unchanged), book)).toEqual({ data: {}, errors: {} });
	});

	it('sends only the changed fields, with meta fields as names', () => {
		const fd = edited('status', 'finished');
		fd.set('title', ' Dune Messiah ');
		expect(buildUpdate(books, fd, book)).toEqual({
			data: { title: 'Dune Messiah', status: 'finished' },
			errors: {}
		});
	});

	it('clears a number with null and a relation with an empty string', () => {
		const fd = edited('year', '');
		fd.set('genre', '');
		expect(buildUpdate(books, fd, book).data).toEqual({ year: null, genre: '' });
	});

	it('sends false for an unchecked flag and true for a newly checked one', () => {
		expect(buildUpdate(books, edited('favorite', null), book).data).toEqual({ favorite: false });
		expect(buildUpdate(books, form(unchanged), { ...book, favorite: false }).data).toEqual({
			favorite: true
		});
	});

	it('flags a cleared required field and sends nothing', () => {
		expect(buildUpdate(books, edited('title', ''), book)).toEqual({
			data: {},
			errors: { title: 'Required' }
		});
	});

	it('leaves an untouched date and JSON list alone, and clears an emptied one', () => {
		const job = {
			company: 'Acme',
			position: '',
			stack: ['Go', 'Postgres'],
			start: '2024-01-05 08:30:00.000Z',
			end: ''
		};
		const same = form([
			['company', 'Acme'],
			['position', ''],
			['stack', 'Go,Postgres'],
			['start', '2024-01-05'],
			['end', '']
		]);
		expect(buildUpdate(records, same, job).data).toEqual({});
		same.set('stack', '');
		same.set('end', '2024-06-30');
		expect(buildUpdate(records, same, job).data).toEqual({
			stack: [],
			end: '2024-06-30 00:00:00.000Z'
		});
	});

	it('treats the same tags in another order, or duplicate tag rows, as unchanged', () => {
		const base = { title: 'T', creator: 'C', url: 'https://x.test', favorite: false };
		const fd = form([
			['title', 'T'],
			['creator', 'C'],
			['url', 'https://x.test'],
			['tags', 'go'],
			['tags', 'tech']
		]);
		const reordered = {
			...base,
			tags: ['t2', 't1'],
			expand: {
				tags: [
					{ id: 't2', name: 'tech' },
					{ id: 't1', name: 'go' }
				]
			}
		};
		expect(buildUpdate(articles, fd, reordered).data).toEqual({});

		// Rivendell's create links every meta row with a tag's name, so one name can appear twice.
		const duplicated = {
			...base,
			tags: ['a1', 'a2'],
			expand: {
				tags: [
					{ id: 'a1', name: 'art' },
					{ id: 'a2', name: 'art' }
				]
			}
		};
		const art = form([
			['title', 'T'],
			['creator', 'C'],
			['url', 'https://x.test'],
			['tags', 'art'],
			['favorite', 'on']
		]);
		expect(buildUpdate(articles, art, duplicated).data).toEqual({ favorite: true });
	});

	it('clears tags with an empty list only where they are optional', () => {
		const article = {
			title: 'T',
			creator: 'C',
			url: 'https://x.test',
			tags: ['t1'],
			expand: { tags: [{ id: 't1', name: 'go' }] }
		};
		const fd = form([
			['title', 'T'],
			['creator', 'C'],
			['url', 'https://x.test']
		]);
		expect(buildUpdate(articles, fd, article).errors).toEqual({ tags: 'Required' });
	});
});

describe('formValues', () => {
	it('echoes what the user typed, keeping every selected tag', () => {
		expect(
			formValues(
				articles,
				form([
					['title', 'T'],
					['tags', 'go'],
					['tags', 'tech']
				])
			)
		).toEqual({
			title: 'T',
			tags: ['go', 'tech']
		});
	});

	it('echoes edit fields, including a checked flag, when given the edit list', () => {
		const values = formValues(
			books,
			form([
				['title', 'T'],
				['favorite', 'on']
			]),
			books.edit
		);
		expect(values).toEqual({ title: 'T', favorite: 'on' });
	});
});

describe('mapPbError', () => {
	it('maps field errors from PocketBase validation data', () => {
		const err = new ClientResponseError({
			status: 400,
			response: {
				message: 'Failed to create record.',
				data: { url: { code: 'validation_not_unique', message: 'Value must be unique.' } }
			}
		});
		expect(mapPbError(err)).toEqual({
			message: 'Please fix the highlighted fields.',
			fields: { url: 'Value must be unique.' },
			generic: false
		});
	});

	it('flags an opaque hook error as generic', () => {
		const err = new ClientResponseError({
			status: 400,
			response: { message: 'Something went wrong while processing your request.', data: {} }
		});
		expect(mapPbError(err)).toMatchObject({ fields: {}, generic: true });
	});
});
