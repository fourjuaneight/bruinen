import { describe, expect, it } from 'vitest';
import { getCollection, type CollectionDef, type FieldDef } from './collections.ts';
import { cellText, flagBadges, recordSections, statusTone, tagNames } from './format.ts';

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

describe('recordSections', () => {
	const books = getCollection('books') as CollectionDef;
	const record = {
		id: 'b1',
		collectionId: 'pbc',
		collectionName: 'books',
		title: 'Project Hail Mary',
		author: 'Andy Weir',
		isbn: '9780593135204',
		genre: 'g1',
		status: 's1',
		year: 2021,
		comments: 'Hardcover.',
		cover: 'https://b2.example/Books/Project_Hail_Mary.jpeg',
		favorite: true,
		publisher: 'Ballantine Books',
		pages: 496,
		openlibrary: 'https://www.openlibrary.org/works/OL1',
		expand: { genre: { name: 'sci-fi' }, status: { name: 'in_progress' } }
	};

	it('puts the create-form fields under Details, minus the title, status and flags', () => {
		const { details } = recordSections(books, record);
		expect(details.map((f) => [f.label, f.text])).toEqual([
			['Author', 'Andy Weir'],
			['ISBN', '9780593135204'],
			['Genre', 'Sci-Fi'],
			['Year', '2021'],
			['Comments', 'Hardcover.']
		]);
	});

	it('puts what Rivendell added under its own section, without the cover', () => {
		const { enriched } = recordSections(books, record);
		expect(enriched.map((f) => f.name)).toEqual(['publisher', 'pages', 'openlibrary']);
	});

	it('links URLs by their host name', () => {
		const link = recordSections(books, record).enriched.find((f) => f.name === 'openlibrary');
		expect(link).toMatchObject({
			href: 'https://www.openlibrary.org/works/OL1',
			text: 'openlibrary.org'
		});
	});

	it('badges the status, the flags, then the pick-one vocabulary values', () => {
		expect(recordSections(books, record).badges).toEqual([
			{ kind: 'status', value: 'in_progress', text: 'In Progress' },
			{ kind: 'flag', name: 'favorite', text: 'Favorite' },
			{ kind: 'vocabulary', text: 'Sci-Fi' }
		]);
	});

	it('gives the subtitle as creator · year', () => {
		expect(recordSections(books, record).subtitle).toBe('Andy Weir · 2021');
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

describe('recordSections display formatting', () => {
	it('title-cases genre, leaving other relations as stored', () => {
		const record = {
			id: 'm1',
			title: 'Arrival',
			genre: 'g1',
			definition: 'd1',
			expand: { genre: { name: 'sci-fi' }, definition: { name: '4k' } }
		};
		const byName = Object.fromEntries(
			recordSections(getCollection('movies') as CollectionDef, record).details.map((f) => [
				f.name,
				f.text
			])
		);
		expect(byName).toMatchObject({ genre: 'Sci-Fi', definition: '4k' });
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

describe('statusTone', () => {
	it.each([
		['in_progress', 'progress'],
		['In Progress', 'progress'],
		['completed', 'ok'],
		['finished', 'ok'],
		['done', 'ok'],
		['not_started', 'idle'],
		['wishlist', 'neutral']
	])('%s → %s', (value, tone) => {
		expect(statusTone(value)).toBe(tone);
	});
});

describe('flagBadges', () => {
	const articles = getCollection('articles') as CollectionDef;

	it('lists the true flags in a fixed order, with their badge text', () => {
		expect(flagBadges(articles, { shared: true, favorite: true, dead: true })).toEqual([
			{ name: 'favorite', label: 'Favorite' },
			{ name: 'dead', label: 'Dead link' },
			{ name: 'shared', label: 'Shared' }
		]);
	});

	it('shows nothing for false flags or collections without them', () => {
		expect(flagBadges(articles, { favorite: false })).toEqual([]);
		expect(flagBadges(getCollection('cds') as CollectionDef, { favorite: true })).toEqual([]);
	});
});

describe('tagNames', () => {
	it('lists the expanded tag names, skipping rows without one', () => {
		expect(
			tagNames({ expand: { tags: [{ name: 'web' }, { id: 'x' }, { name: 'history' }] } })
		).toEqual(['web', 'history']);
		expect(tagNames({})).toEqual([]);
	});
});
