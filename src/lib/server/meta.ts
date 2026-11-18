import type { CollectionDef, MetaType } from '../collections.ts';

export type MetaOptions = Partial<Record<MetaType, string[]>>;

/** The slice of the PocketBase client this module needs, so tests can pass a fake. */
export interface MetaSource {
	collection(name: string): {
		getFullList(opts: { sort: string; fields: string }): Promise<{ name: string; type: string }[]>;
	};
}

/** Names for each meta type the collection's create form needs, sorted by name. */
export async function loadMetaOptions(pb: MetaSource, def: CollectionDef): Promise<MetaOptions> {
	const types = new Set(def.create.flatMap((f) => (f.metaType ? [f.metaType] : [])));
	if (!types.size) return {};

	const rows = await pb.collection('meta').getFullList({ sort: 'name', fields: 'name,type' });
	const options: MetaOptions = {};
	for (const row of rows) {
		const type = row.type as MetaType;
		if (types.has(type)) (options[type] ??= []).push(row.name);
	}
	return options;
}
