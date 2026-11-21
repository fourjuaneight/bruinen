import { describe, expect, it } from 'vitest';
import { getCollection, type CollectionDef } from './collections.ts';
import { recordValues } from './forms.ts';

const books = getCollection('books') as CollectionDef;
const articles = getCollection('articles') as CollectionDef;
const records = getCollection('records') as CollectionDef;
const mtg = getCollection('mtg') as CollectionDef;

describe('recordValues', () => {
	it('turns text, numbers, meta names and flags into form values', () => {
		const book = {
			id: 'b1',
			title: 'Dune',
			author: 'Frank Herbert',
			isbn: '9780441013593',
			genre: 'g1',
			status: 's1',
			year: 1965,
			comments: '',
			favorite: true,
			expand: { genre: { id: 'g1', name: 'fiction' }, status: { id: 's1', name: 'reading' } }
		};
		expect(recordValues(books, book)).toEqual({
			title: 'Dune',
			author: 'Frank Herbert',
			isbn: '9780441013593',
			genre: 'fiction',
			status: 'reading',
			year: '1965',
			comments: '',
			favorite: 'on'
		});
	});

	it('leaves unchecked flags and missing relations out, and blanks an empty number', () => {
		const book = { title: 'Dune', author: 'F', year: 0, genre: '', favorite: false };
		const values = recordValues(books, book);
		expect(values.year).toBe('');
		expect(values).not.toHaveProperty('favorite');
		expect(values.genre).toBe('');
	});

	it('keeps a zero in a required number', () => {
		const card = { name: 'Island', set: 'lea', collector_number: 0 };
		expect(recordValues(mtg, card).collector_number).toBe('0');
	});

	it('lists tag names from the expanded relation', () => {
		const article = {
			title: 'Go',
			tags: ['t1', 't2'],
			expand: {
				tags: [
					{ id: 't1', name: 'go' },
					{ id: 't2', name: 'tech' }
				]
			}
		};
		expect(recordValues(articles, article).tags).toEqual(['go', 'tech']);
	});

	it('cuts dates to the day and joins JSON lists', () => {
		const job = {
			company: 'Acme',
			start: '2024-01-05 00:00:00.000Z',
			end: '',
			stack: ['Go', 'Postgres']
		};
		expect(recordValues(records, job)).toMatchObject({
			start: '2024-01-05',
			end: '',
			stack: 'Go, Postgres'
		});
	});
});
