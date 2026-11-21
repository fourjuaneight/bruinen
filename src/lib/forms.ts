import type { CollectionDef, FieldDef } from './collections.ts';

export type FormValues = Record<string, string | string[]>;

/** What the create and update actions send back on failure (and what RecordForm renders). */
export interface CreateFormState {
	message?: string;
	fields?: Record<string, string>;
	values?: FormValues;
	pending?: boolean;
}

type Item = Record<string, unknown> & { expand?: Record<string, unknown> };

const nameOf = (value: unknown) =>
	value && typeof value === 'object' && 'name' in value ? String(value.name) : '';

function fieldValue(field: FieldDef, record: Item): string | string[] | undefined {
	const raw = record[field.name];
	switch (field.type) {
		case 'meta':
			return nameOf(record.expand?.[field.name]);
		case 'tags': {
			const tags = record.expand?.[field.name];
			return Array.isArray(tags) ? tags.map(nameOf).filter(Boolean) : [];
		}
		case 'bool':
			return raw ? 'on' : undefined;
		case 'number':
			// PocketBase stores an empty number as 0.
			if (typeof raw !== 'number') return '';
			return raw === 0 && !field.required ? '' : String(raw);
		case 'date':
			return typeof raw === 'string' ? raw.slice(0, 10) : '';
		case 'json':
			return Array.isArray(raw) ? raw.join(', ') : '';
		default:
			return raw == null ? '' : String(raw);
	}
}

/**
 * A stored record as edit-form values: the inverse of formValues(). Meta relations become names,
 * dates become YYYY-MM-DD, and a checked flag is 'on' (an unchecked one is left out, like a form).
 */
export function recordValues(def: CollectionDef, record: Item): FormValues {
	const values: FormValues = {};
	for (const field of def.edit) {
		const value = fieldValue(field, record);
		if (value !== undefined) values[field.name] = value;
	}
	return values;
}
