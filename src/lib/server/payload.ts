import { ClientResponseError } from 'pocketbase';
import type { CollectionDef, FieldDef } from '../collections.ts';

export type FieldErrors = Record<string, string>;
export type FormValues = Record<string, string | string[]>;

const MAX_TAGS = 5;
const REJECTED = 'Rivendell rejected this record. Check the values and try again.';

const str = (form: FormData, name: string) => String(form.get(name) ?? '').trim();
const list = (form: FormData, name: string) =>
	form
		.getAll(name)
		.map((v) => String(v).trim())
		.filter(Boolean);

function parseField(field: FieldDef, form: FormData): { value?: unknown; error?: string } {
	if (field.type === 'tags') {
		const tags = list(form, field.name);
		if (tags.length > MAX_TAGS) return { error: `Up to ${MAX_TAGS} tags` };
		return tags.length ? { value: tags } : {};
	}

	const raw = str(form, field.name);
	if (!raw) return {};

	switch (field.type) {
		case 'number': {
			const n = Number(raw);
			return Number.isFinite(n) ? { value: n } : { error: 'Must be a number' };
		}
		case 'date':
			return /^\d{4}-\d{2}-\d{2}$/.test(raw)
				? { value: `${raw} 00:00:00.000Z` }
				: { error: 'Use the format YYYY-MM-DD' };
		case 'json':
			return {
				value: raw
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean)
			};
		case 'bool':
			return { value: true };
		default:
			return { value: raw };
	}
}

/** Turn the create form into Rivendell's create payload. Meta fields stay as names. */
export function buildPayload(
	def: CollectionDef,
	form: FormData
): { data: Record<string, unknown>; errors: FieldErrors } {
	const data: Record<string, unknown> = {};
	const errors: FieldErrors = {};
	for (const field of def.create) {
		const { value, error } = parseField(field, form);
		if (error) errors[field.name] = error;
		else if (value !== undefined) data[field.name] = value;
		else if (field.required) errors[field.name] = 'Required';
	}
	return { data, errors };
}

/** What the user typed, to refill the form after a failed submit (needed without JS). */
export function formValues(def: CollectionDef, form: FormData): FormValues {
	const values: FormValues = {};
	for (const field of def.create) {
		if (field.type === 'tags') {
			const tags = list(form, field.name);
			if (tags.length) values[field.name] = tags;
		} else if (form.has(field.name)) {
			values[field.name] = String(form.get(field.name));
		}
	}
	return values;
}

/**
 * PocketBase validation errors carry per-field messages. Errors returned by Rivendell's hooks
 * arrive as a generic 400 with empty data, so the cause can't be shown; `generic` flags that.
 */
export function mapPbError(err: unknown): {
	message: string;
	fields: FieldErrors;
	generic: boolean;
} {
	const data = err instanceof ClientResponseError ? (err.response?.data ?? {}) : {};
	const fields: FieldErrors = {};
	for (const [name, detail] of Object.entries(data as Record<string, { message?: string }>)) {
		if (detail?.message) fields[name] = detail.message;
	}
	const generic = Object.keys(fields).length === 0;
	return { message: generic ? REJECTED : 'Please fix the highlighted fields.', fields, generic };
}
