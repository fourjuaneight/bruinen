import { describe, expect, it } from 'vitest';
import schema from '../../tests/fixtures/rivendell-schema.json' with { type: 'json' };
import { COLLECTIONS, getCollection } from './collections.ts';

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

		it('flags slow creates only for archived collections', () => {
			expect(Boolean(def.slowCreate)).toBe(['articles', 'podcasts', 'videos'].includes(name));
		});
	});
});
