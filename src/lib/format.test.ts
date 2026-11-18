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
