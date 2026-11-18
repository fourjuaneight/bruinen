import { describe, expect, it } from 'vitest';
import type { FieldDef } from './collections.ts';
import { cellText } from './format.ts';

const f = (type: FieldDef['type'], name = 'x'): FieldDef => ({ name, label: name, type });

describe('cellText', () => {
	it('shows expanded meta names, not IDs', () => {
		const item = { genre: 'id1', expand: { genre: { id: 'id1', name: 'drama' } } };
		expect(cellText(f('meta', 'genre'), item)).toBe('drama');
	});

	it('joins expanded tag names', () => {
		const item = { tags: ['a', 'b'], expand: { tags: [{ name: 'go' }, { name: 'rust' }] } };
		expect(cellText(f('tags', 'tags'), item)).toBe('go, rust');
	});

	it('renders booleans as Yes or nothing', () => {
		expect(cellText(f('bool'), { x: true })).toBe('Yes');
		expect(cellText(f('bool'), { x: false })).toBe('');
	});

	it('trims PocketBase dates to the day', () => {
		expect(cellText(f('date'), { x: '2022-01-01 00:00:00.000Z' })).toBe('2022-01-01');
	});

	it('joins JSON arrays', () => {
		expect(cellText(f('json'), { x: ['Go', 'Postgres'] })).toBe('Go, Postgres');
	});

	it('hides zero years and empty values', () => {
		expect(cellText(f('number'), { x: 0 })).toBe('');
		expect(cellText(f('text'), {})).toBe('');
	});
});

describe('detailFields', () => {
	it('labels known fields, resolves relations, links URLs and skips system fields', async () => {
		const { detailFields } = await import('./format.ts');
		const { getCollection } = await import('./collections.ts');
		const def = getCollection('books')!;
		const record = {
			id: 'b1',
			collectionId: 'pbc',
			collectionName: 'books',
			title: 'Dune',
			author: 'Frank Herbert',
			isbn: '',
			genre: 'g1',
			cover: 'https://b2.example/Books/Dune.jpeg',
			favorite: true,
			expand: { genre: { name: 'fiction' } }
		};
		expect(detailFields(def, record)).toEqual([
			{ name: 'title', label: 'Title', text: 'Dune' },
			{ name: 'author', label: 'Author', text: 'Frank Herbert' },
			{ name: 'genre', label: 'Genre', text: 'fiction' },
			{
				name: 'cover',
				label: 'Cover',
				text: 'https://b2.example/Books/Dune.jpeg',
				href: 'https://b2.example/Books/Dune.jpeg'
			},
			{ name: 'favorite', label: 'Favorite', text: 'Yes' }
		]);
	});
});
