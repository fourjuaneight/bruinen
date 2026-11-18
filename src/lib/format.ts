import type { CollectionDef, FieldDef } from './collections.ts';

type Item = Record<string, unknown> & { expand?: Record<string, unknown> };

const nameOf = (value: unknown) =>
	value && typeof value === 'object' && 'name' in value ? String(value.name) : '';

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

export interface DetailField {
	name: string;
	label: string;
	text: string;
	href?: string;
}

const humanize = (name: string) =>
	name.charAt(0).toUpperCase() + name.slice(1).replaceAll('_', ' ');

function fieldFor(def: CollectionDef, name: string, value: unknown): FieldDef {
	const known = [...def.columns, ...def.create].find((f) => f.name === name);
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
		const text = cellText(fieldFor(def, name, value), record);
		if (!text) continue;
		const field: DetailField = { name, label: fieldFor(def, name, value).label, text };
		if (/^https?:\/\//.test(text)) field.href = text;
		fields.push(field);
	}
	return fields;
}
