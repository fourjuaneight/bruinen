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
			{ name: 'genre', label: 'Genre', text: 'Fiction' },
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

describe('titleCase', () => {
	it('capitalizes words and turns underscores into spaces', async () => {
		const { titleCase } = await import('./format.ts');
		expect(titleCase('not_started')).toBe('Not Started');
		expect(titleCase('in_progress')).toBe('In Progress');
		expect(titleCase('sci-fi')).toBe('Sci-Fi');
		expect(titleCase('hip hop')).toBe('Hip Hop');
		expect(titleCase('')).toBe('');
	});
});

describe('detailFields display formatting', () => {
	it('title-cases genre and status, leaving other relations as stored', async () => {
		const { detailFields } = await import('./format.ts');
		const { getCollection } = await import('./collections.ts');
		const record = {
			id: 'm1',
			title: 'Arrival',
			genre: 'g1',
			definition: 'd1',
			status: 's1',
			expand: {
				genre: { name: 'sci-fi' },
				definition: { name: '4k' },
				status: { name: 'not_started' }
			}
		};
		const byName = Object.fromEntries(
			detailFields(getCollection('movies')!, record).map((f) => [f.name, f.text])
		);
		expect(byName).toMatchObject({ genre: 'Sci-Fi', status: 'Not Started', definition: '4k' });
	});
});

describe('cardExtra', () => {
	it('shows the season for shows', async () => {
		const { cardExtra } = await import('./format.ts');
		const { getCollection } = await import('./collections.ts');
		const shows = getCollection('shows')!;
		expect(cardExtra(shows, { season: 2 })).toBe('Season 2');
		expect(cardExtra(shows, { season: 0 })).toBe('');
	});

	it('shows the platform in uppercase for games', async () => {
		const { cardExtra } = await import('./format.ts');
		const { getCollection } = await import('./collections.ts');
		const games = getCollection('games')!;
		expect(cardExtra(games, { platform: 'p1', expand: { platform: { name: 'ps5' } } })).toBe('PS5');
		expect(cardExtra(games, {})).toBe('');
	});

	it('adds nothing for other collections', async () => {
		const { cardExtra } = await import('./format.ts');
		const { getCollection } = await import('./collections.ts');
		expect(cardExtra(getCollection('movies')!, { season: 3 })).toBe('');
	});
});
