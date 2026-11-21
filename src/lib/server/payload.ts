import { ClientResponseError } from 'pocketbase';
import type { CollectionDef, FieldDef } from '../collections.ts';
import { recordValues, type FormValues } from '../forms.ts';

export type { FormValues };
export type FieldErrors = Record<string, string>;

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

/** What an edit sends to clear a field the user emptied. */
function emptyValue(field: FieldDef): unknown {
	switch (field.type) {
		case 'number':
			return null;
		case 'json':
		case 'tags':
			return [];
		case 'bool':
			return false;
		default:
			return '';
	}
}

/** The submitted value in recordValues() form, so an untouched field compares equal. */
function canonical(field: FieldDef, form: FormData): string | string[] | undefined {
	switch (field.type) {
		case 'tags':
			return list(form, field.name);
		case 'bool':
			return form.has(field.name) ? 'on' : undefined;
		case 'json':
			return str(form, field.name)
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
				.join(', ');
		case 'number': {
			const raw = str(form, field.name);
			return raw && Number.isFinite(Number(raw)) ? String(Number(raw)) : raw;
		}
		default:
			return str(form, field.name);
	}
}

/**
 * Tags compare as a set of names: the form submits them in option order, Rivendell stores them in
 * meta row order, and one name can be linked through several duplicate meta rows.
 */
function same(field: FieldDef, submitted: unknown, stored: unknown): boolean {
	if (field.type === 'tags') {
		const names = (v: unknown) => [...new Set(Array.isArray(v) ? v.map(String) : [])].sort();
		return JSON.stringify(names(submitted)) === JSON.stringify(names(stored));
	}
	return JSON.stringify(submitted) === JSON.stringify(stored);
}

/**
 * Turn the edit form into a PATCH payload holding only the fields that differ from the stored
 * record, so untouched values (a date's time of day, which duplicate meta row a relation points
 * at) are never rewritten. Emptied fields are sent as explicit empty values. Meta fields are
 * still names here; resolveMetaIds turns them into IDs.
 */
export function buildUpdate(
	def: CollectionDef,
	form: FormData,
	current: Record<string, unknown>
): { data: Record<string, unknown>; errors: FieldErrors } {
	const stored = recordValues(def, current);
	const data: Record<string, unknown> = {};
	const errors: FieldErrors = {};
	for (const field of def.edit) {
		const { value, error } = parseField(field, form);
		if (error) {
			errors[field.name] = error;
			continue;
		}
		if (value === undefined && field.required) {
			errors[field.name] = 'Required';
			continue;
		}
		if (same(field, canonical(field, form), stored[field.name])) continue;
		data[field.name] = value === undefined ? emptyValue(field) : value;
	}
	return { data, errors };
}

/** What the user typed, to refill the form after a failed submit (needed without JS). */
export function formValues(
	def: CollectionDef,
	form: FormData,
	fields: readonly FieldDef[] = def.create
): FormValues {
	const values: FormValues = {};
	for (const field of fields) {
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
