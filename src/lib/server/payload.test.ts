import { ClientResponseError } from 'pocketbase';
import { describe, expect, it } from 'vitest';
import { getCollection, type CollectionDef } from '../collections.ts';
import { buildPayload, formValues, mapPbError } from './payload.ts';

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
