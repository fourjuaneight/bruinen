import type { CollectionDef, FieldDef } from './collections.ts';

/** A PocketBase record, with its expanded relations. */
export type Item = Record<string, unknown> & { expand?: Record<string, unknown> };

/** The name of an expanded meta row, or '' for anything else. */
export const nameOf = (value: unknown) =>
	value && typeof value === 'object' && 'name' in value ? String(value.name) : '';

/** A field the collection shows or creates, by name. */
const knownField = (def: CollectionDef, name: string) =>
	def.columns.find((f) => f.name === name) ?? def.create.find((f) => f.name === name);

/** Plain-text value of a field for tables, cards and the detail page. */
export function cellText(field: FieldDef, item: Item): string {
	const raw = item[field.name];
	switch (field.type) {
		case 'meta':
			return nameOf(item.expand?.[field.name]);
		case 'tags': {
			const tags = item.expand?.[field.name];
			return Array.isArray(tags) ? tags.map(nameOf).filter(Boolean).join(', ') : '';
		}
		case 'bool':
			return raw ? 'Yes' : '';
		case 'date':
			return typeof raw === 'string' ? raw.slice(0, 10) : '';
		case 'json':
			return Array.isArray(raw) ? raw.join(', ') : raw ? JSON.stringify(raw) : '';
		case 'number':
			return typeof raw === 'number' && raw !== 0 ? String(raw) : '';
		default:
			return raw == null ? '' : String(raw);
	}
}

const SYSTEM_FIELDS = new Set(['id', 'collectionId', 'collectionName', 'expand']);

/** Relations shown title-cased on the record page ("not_started" → "Not Started"). */
const TITLE_CASE_FIELDS = new Set(['genre', 'status']);

/** "not_started" → "Not Started", "sci-fi" → "Sci-Fi". */
export function titleCase(value: string): string {
	return value
		.replaceAll('_', ' ')
		.replace(/(^|[\s-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

export interface DetailField {
	name: string;
	label: string;
	text: string;
	href?: string;
}

const humanize = (name: string) =>
	name.charAt(0).toUpperCase() + name.slice(1).replaceAll('_', ' ');

function fieldFor(def: CollectionDef, name: string, value: unknown): FieldDef {
	const known = knownField(def, name);
	if (known) return { ...known, label: known.label.replace(/ \(comma separated\)$/, '') };
	if (def.expand.includes(name)) return { name, label: humanize(name), type: 'meta' };
	if (typeof value === 'boolean') return { name, label: humanize(name), type: 'bool' };
	if (typeof value === 'number') return { name, label: humanize(name), type: 'number' };
	if (Array.isArray(value)) return { name, label: humanize(name), type: 'json' };
	return { name, label: humanize(name), type: 'text' };
}

/** Every non-empty field of a record, in record order, ready for a definition list. */
export function detailFields(def: CollectionDef, record: Item): DetailField[] {
	const fields: DetailField[] = [];
	for (const [name, value] of Object.entries(record)) {
		if (SYSTEM_FIELDS.has(name)) continue;
		const shown = fieldFor(def, name, value);
		const raw = cellText(shown, record);
		if (!raw) continue;
		const text = TITLE_CASE_FIELDS.has(name) ? titleCase(raw) : raw;
		const field: DetailField = { name, label: shown.label, text };
		if (/^https?:\/\//.test(text)) field.href = text;
		fields.push(field);
	}
	return fields;
}

/** The extra card line for collections that have one (see CollectionDef.cardExtra). */
export function cardExtra(def: CollectionDef, item: Item): string {
	const extra = def.cardExtra;
	if (!extra) return '';
	const field = knownField(def, extra.field);
	const text = field ? cellText(field, item) : '';
	if (!text) return '';
	return extra.style === 'season' ? `Season ${text}` : text.toUpperCase();
}

export type StatusTone = 'progress' | 'ok' | 'idle' | 'neutral';

const DONE = new Set(['completed', 'finished', 'done']);

/** The chip colour for a status from Meta. The chip always shows the text too. */
export function statusTone(value: string): StatusTone {
	const key = value
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, '_');
	if (key === 'in_progress') return 'progress';
	if (DONE.has(key)) return 'ok';
	if (key === 'not_started') return 'idle';
	return 'neutral';
}

const FLAG_LABELS = { favorite: 'Favorite', dead: 'Dead link', shared: 'Shared' } as const;

export type FlagName = keyof typeof FLAG_LABELS;

/** Badges for the flags a record has set, in a fixed order. They replace "Yes". */
export function flagBadges(def: CollectionDef, item: Item): { name: FlagName; label: string }[] {
	const flags = new Set(def.edit.filter((f) => f.type === 'bool').map((f) => f.name));
	return (Object.keys(FLAG_LABELS) as FlagName[])
		.filter((name) => flags.has(name) && item[name] === true)
		.map((name) => ({ name, label: FLAG_LABELS[name] }));
}
