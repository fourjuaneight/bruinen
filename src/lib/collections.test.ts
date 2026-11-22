import { describe, expect, it } from 'vitest';
import schema from '../../tests/fixtures/rivendell-schema.json' with { type: 'json' };
import { COLLECTIONS, getCollection, NAV_GROUPS } from './collections.ts';

type SchemaField = { name: string; type: string; required: boolean };
const fixture = schema as Record<string, SchemaField[]>;
const base = (path: string) => path.split('.')[0];
const IMAGE_COLLECTIONS = ['books', 'cds', 'games', 'movies', 'shows', 'vinyls'];
const BARCODE_COLLECTIONS = ['cds', 'vinyls', 'games', 'movies', 'shows'];
const AUTO_FILLED = ['cover', 'archive', 'dead', 'shared', 'image', 'back', 'id'];

describe('collection registry', () => {
	it('covers exactly the Rivendell collections', () => {
		expect(COLLECTIONS.map((c) => c.name).sort()).toEqual(Object.keys(fixture).sort());
		expect(COLLECTIONS).toHaveLength(16);
	});

	it('names one item of each collection, for "Add {item}"', () => {
		expect(Object.fromEntries(COLLECTIONS.map((c) => [c.name, c.singular]))).toEqual({
			movies: 'movie',
			shows: 'show',
			games: 'game',
			books: 'book',
			cds: 'CD',
			vinyls: 'vinyl',
			mtg: 'card',
			articles: 'article',
			podcasts: 'podcast',
			videos: 'video',
			feeds: 'feed',
			read_later: 'link',
			watch_later: 'video',
			github: 'repo',
			records: 'work record',
			meta: 'entry'
		});
	});

	it('groups the navigation as physical, digital and vocabulary, in that order', () => {
		const groups = (group: string) =>
			COLLECTIONS.filter((c) => c.group === group).map((c) => c.label);
		expect(groups('physical')).toEqual([
			'Movies',
			'Shows',
			'Games',
			'Books',
			'CDs',
			'Vinyls',
			'MTG'
		]);
		expect(groups('digital')).toEqual([
			'Articles',
			'Podcasts',
			'Videos',
			'Feeds',
			'Read later',
			'Watch later',
			'GitHub',
			'Work records'
		]);
		expect(groups('vocabulary')).toEqual(['Meta']);
		// The nav renders groups in registry order, so physical must come first.
		expect(COLLECTIONS.map((c) => c.group)).toEqual(
			[...COLLECTIONS.map((c) => c.group)].sort(
				(a, b) =>
					['physical', 'digital', 'vocabulary'].indexOf(a) -
					['physical', 'digital', 'vocabulary'].indexOf(b)
			)
		);
	});

	it('labels every navigation group once, in display order', () => {
		expect(NAV_GROUPS).toEqual([
			{ id: 'physical', label: 'Physical' },
			{ id: 'digital', label: 'Digital' },
			{ id: 'vocabulary', label: 'Vocabulary' }
		]);
	});

	it('searches the scannable field, so a scanned code finds its record', () => {
		for (const def of COLLECTIONS) {
			const scanned = def.create.find((f) => f.scan);
			if (scanned) expect(def.searchFields, def.name).toContain(scanned.name);
		}
	});

	it('getCollection finds by name and rejects unknown names', () => {
		expect(getCollection('movies')?.label).toBe('Movies');
		expect(getCollection('nope')).toBeUndefined();
	});

	describe.each(COLLECTIONS.map((c) => [c.name, c] as const))('%s', (name, def) => {
		const fieldNames = fixture[name].map((f) => f.name);

		it('only references fields that exist in the schema', () => {
			const used = [
				...def.columns.map((f) => f.name),
				...def.create.map((f) => f.name),
				...def.searchFields,
				...def.sortable,
				...def.expand,
				def.titleField,
				def.keyField,
				...(def.cardExtra ? [def.cardExtra.field] : [])
			].map(base);
			for (const field of used) expect(fieldNames, `${name}.${field}`).toContain(field);
		});

		it('marks every schema-required field as required in the create form', () => {
			for (const field of fixture[name].filter((f) => f.required && f.name !== 'id')) {
				const input = def.create.find((f) => f.name === field.name);
				expect(input?.required, `${name}.${field.name}`).toBe(true);
			}
		});

		it('never asks for fields Rivendell fills in', () => {
			for (const field of def.create) expect(AUTO_FILLED).not.toContain(field.name);
		});

		it('has a valid default sort and no created/updated sorting', () => {
			const sortField = def.defaultSort.replace(/^-/, '');
			expect(sortField === '@rowid' || def.sortable.includes(sortField)).toBe(true);
			expect(def.sortable).not.toContain('created');
			expect(def.sortable).not.toContain('updated');
		});

		it('gives meta and tags fields a meta type', () => {
			const missing = def.create
				.filter((f) => (f.type === 'meta' || f.type === 'tags') && !f.metaType)
				.map((f) => f.name);
			expect(missing).toEqual([]);
			const tags = def.create.find((f) => f.name === 'tags');
			if (tags) expect(tags).toMatchObject({ type: 'tags', metaType: 'tags' });
		});

		it('shows cover images only where Rivendell stores them', () => {
			if (IMAGE_COLLECTIONS.includes(name)) expect(def.image).toBe('cover');
			else if (name === 'mtg') expect(def.image).toBe('image');
			else expect(def.image).toBeUndefined();
		});

		it('offers scanning only for ISBNs and barcodes', () => {
			const scans = def.create.filter((f) => f.scan).map((f) => `${f.name}:${f.scan}`);
			if (name === 'books') expect(scans).toEqual(['isbn:isbn']);
			else if (BARCODE_COLLECTIONS.includes(name)) expect(scans).toEqual(['barcode:barcode']);
			else expect(scans).toEqual([]);
		});

		it('edits every create field plus the flags the collection stores', () => {
			const editNames = def.edit.map((f) => f.name);
			expect(editNames.slice(0, def.create.length)).toEqual(def.create.map((f) => f.name));
			const flags = editNames.slice(def.create.length);
			const stored = ['favorite', 'dead', 'shared'].filter((f) => fieldNames.includes(f));
			expect(flags).toEqual(stored);
			for (const flag of def.edit.slice(def.create.length)) expect(flag.type).toBe('bool');
		});

		it('gives every edit field a schema field of a matching type', () => {
			const types: Record<string, string> = { meta: 'relation', tags: 'relation', bool: 'bool' };
			for (const field of def.edit) {
				const stored = fixture[name].find((f) => f.name === field.name);
				expect(stored, `${name}.${field.name}`).toBeDefined();
				if (types[field.type])
					expect(stored?.type, `${name}.${field.name}`).toBe(types[field.type]);
			}
		});

		it('marks the collections Rivendell enriches after create', () => {
			// Mirrors the enrichers map in rivendell/main.go.
			const enriched = ['articles', 'podcasts', 'videos', 'github', 'mtg', 'books', 'cds'].concat([
				'games',
				'movies',
				'shows',
				'vinyls',
				'watch_later'
			]);
			expect(Boolean(def.enriched)).toBe(enriched.includes(name));
		});

		it('flags slow creates only for archived collections', () => {
			expect(Boolean(def.slowCreate)).toBe(['articles', 'podcasts', 'videos'].includes(name));
		});
	});
});
