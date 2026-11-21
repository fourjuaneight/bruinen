import { ClientResponseError } from 'pocketbase';
import type { CollectionDef } from '../collections.ts';
import { mapPbError, type FieldErrors } from './payload.ts';

export type UpdateResult =
	| { kind: 'updated'; label: string }
	| { kind: 'unchanged' }
	| { kind: 'invalid'; message: string; fields: FieldErrors };

/** The slice of the PocketBase client updateRecord uses, so tests can pass a fake. */
export interface UpdateTarget {
	collection(name: string): {
		update(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
	};
}

/**
 * PATCH a record. Rivendell has no update hook, so this is a plain, fast PocketBase update:
 * no enrichment runs and relation fields must already hold meta IDs (see resolveMetaIds).
 * Unreachable Rivendell and missing records are rethrown for the error page.
 */
export async function updateRecord(
	pb: UpdateTarget,
	def: CollectionDef,
	id: string,
	data: Record<string, unknown>
): Promise<UpdateResult> {
	if (!Object.keys(data).length) return { kind: 'unchanged' };
	try {
		const saved = await pb.collection(def.name).update(id, data);
		return { kind: 'updated', label: String(saved[def.titleField] ?? '') };
	} catch (err) {
		if (!(err instanceof ClientResponseError) || err.status === 0 || err.status === 404) throw err;
		const { message, fields } = mapPbError(err);
		return { kind: 'invalid', message, fields };
	}
}
