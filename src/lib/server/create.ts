import { ClientResponseError } from 'pocketbase';
import type { CollectionDef } from '../collections.ts';
import { mapPbError, type FieldErrors } from './payload.ts';
import { longFetch } from './pb.ts';

export type CreateResult =
	| { kind: 'created'; id: string; label: string }
	| { kind: 'saved-unenriched'; id: string; label: string }
	| { kind: 'pending' }
	| { kind: 'invalid'; message: string; fields: FieldErrors };

/** The slice of the PocketBase client createRecord uses, so tests can pass a fake. */
export interface CreateTarget {
	filter(expr: string, params: Record<string, unknown>): string;
	collection(name: string): {
		create(
			data: Record<string, unknown>,
			options?: { fetch: typeof longFetch }
		): Promise<{ id: string }>;
		getList(
			page: number,
			perPage: number,
			options: { filter: string; sort: string; fields: string }
		): Promise<{ items: { id: string }[] }>;
	};
}

const TIMEOUT_CODES = new Set(['UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT']);

function isTimeout(err: unknown): boolean {
	if (!(err instanceof ClientResponseError) || err.status !== 0) return false;
	const original = err.originalError as { name?: string; cause?: { code?: string } } | null;
	return (
		err.isAbort ||
		original?.name === 'TimeoutError' ||
		TIMEOUT_CODES.has(original?.cause?.code ?? '')
	);
}

async function latestIdWithKey(pb: CreateTarget, def: CollectionDef, key: string) {
	const res = await pb.collection(def.name).getList(1, 1, {
		filter: pb.filter(`${def.keyField} = {:v}`, { v: key }),
		sort: '-@rowid',
		fields: 'id'
	});
	return res.items[0]?.id;
}

/**
 * Create a record and say what actually happened. Rivendell saves the record before enriching
 * it, so an opaque 400 can mean "rejected" or "saved, enrichment failed"; comparing the newest
 * record with the same key before and after tells the two apart.
 */
export async function createRecord(
	pb: CreateTarget,
	def: CollectionDef,
	data: Record<string, unknown>
): Promise<CreateResult> {
	const key = typeof data[def.keyField] === 'string' ? (data[def.keyField] as string) : '';
	const label = String(data[def.titleField] ?? key);
	const before = key ? await latestIdWithKey(pb, def, key) : undefined;

	try {
		const record = await pb
			.collection(def.name)
			.create(data, def.slowCreate ? { fetch: longFetch } : undefined);
		const saved = record as Record<string, unknown>;
		return { kind: 'created', id: record.id, label: String(saved[def.titleField] ?? label) };
	} catch (err) {
		if (isTimeout(err)) return { kind: 'pending' };
		const mapped = mapPbError(err);
		if (!(err instanceof ClientResponseError) || err.status === 0) throw err;
		if (mapped.generic && key) {
			const after = await latestIdWithKey(pb, def, key);
			if (after && after !== before) return { kind: 'saved-unenriched', id: after, label };
		}
		return { kind: 'invalid', message: mapped.message, fields: mapped.fields };
	}
}
