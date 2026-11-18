import type { FieldDef } from './collections.ts';

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
