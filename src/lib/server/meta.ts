import type { CollectionDef, MetaType } from '../collections.ts';
import type { FieldErrors } from './payload.ts';

export type MetaOptions = Partial<Record<MetaType, string[]>>;

/** The slice of the PocketBase client this module needs, so tests can pass a fake. */
export interface MetaSource {
	collection(name: string): {
		getFullList(opts: {
			sort: string;
			fields: string;
		}): Promise<{ id?: string; name: string; type: string }[]>;
	};
}

/** Names for each meta type the collection's create form needs, sorted by name. */
export async function loadMetaOptions(pb: MetaSource, def: CollectionDef): Promise<MetaOptions> {
	const types = new Set(def.edit.flatMap((f) => (f.metaType ? [f.metaType] : [])));
	if (!types.size) return {};

	const rows = await pb.collection('meta').getFullList({ sort: 'name', fields: 'name,type' });
	// Rivendell's meta table can hold the same name twice for one type (e.g. two "art" genres).
	// Creates send names, so one entry per name is all the form needs.
	const options: MetaOptions = {};
	for (const row of rows) {
		const type = row.type as MetaType;
		if (!types.has(type)) continue;
		const names = (options[type] ??= []);
		if (!names.includes(row.name)) names.push(row.name);
	}
	return options;
}

type Expanded = { id?: unknown; name?: unknown };

/** name → ID for the meta rows a record's relation field already points at. */
function currentIds(record: Record<string, unknown>, field: string): Map<string, string> {
	const expand = (record.expand ?? {}) as Record<string, Expanded | Expanded[] | undefined>;
	const value = expand[field];
	const rows = Array.isArray(value) ? value : value ? [value] : [];
	return new Map(rows.map((row) => [String(row.name), String(row.id)]));
}

/**
 * Swap the meta names in an update payload for meta IDs, which PocketBase needs because Rivendell
 * has no update hook to resolve them. A name the record already uses keeps its current row, so a
 * duplicate name never jumps to the other row; a new name takes the first row, like Rivendell's
 * create preparers do. Names with no row come back as field errors.
 */
export async function resolveMetaIds(
	pb: MetaSource,
	def: CollectionDef,
	data: Record<string, unknown>,
	current: Record<string, unknown>
): Promise<{ data: Record<string, unknown>; errors: FieldErrors }> {
	const relations = def.edit.filter((f) => f.metaType && f.name in data);
	if (!relations.length) return { data, errors: {} };

	const rows = await pb.collection('meta').getFullList({ sort: '@rowid', fields: 'id,name,type' });
	const first = (type: string, name: string) =>
		rows.find((row) => row.type === type && row.name === name)?.id;

	const out = { ...data };
	const errors: FieldErrors = {};
	for (const field of relations) {
		const kept = currentIds(current, field.name);
		const lookup = (name: string) => kept.get(name) ?? first(field.metaType as string, name);
		const value = data[field.name];
		const names = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
		const unknown = names.filter((name) => !lookup(name));
		if (unknown.length) {
			const noun =
				field.type === 'tags' ? (unknown.length > 1 ? 'tags' : 'tag') : field.label.toLowerCase();
			errors[field.name] = `Unknown ${noun}: ${unknown.join(', ')}`;
			continue;
		}
		const ids = names.map((name) => lookup(name) as string);
		out[field.name] = Array.isArray(value) ? ids : (ids[0] ?? '');
	}
	return { data: out, errors };
}
