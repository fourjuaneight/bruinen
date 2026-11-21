import type { CollectionDef } from '../collections.ts';
import { COVER_MESSAGES, MAX_COVER_BYTES } from '../covers.ts';
import { B2Error, type B2Client } from './b2.ts';
import { coverPath, ownCoverPath, publicUrl } from './cover-path.ts';
import { InvalidJpegError, isJpeg, stripMetadata } from './jpeg.ts';
import { updateRecord, type UpdateTarget } from './update.ts';

/** The slice of the PocketBase client replaceCover uses, so tests can pass a fake. */
export interface CoverTarget extends UpdateTarget {
	collection(name: string): ReturnType<UpdateTarget['collection']> & {
		getList(
			page: number,
			perPage: number,
			options: { filter: string; fields: string }
		): Promise<{ items: { id: string }[] }>;
	};
}

export type CoverResult = { kind: 'updated'; url: string } | { kind: 'invalid'; message: string };

const invalid = (message: string): CoverResult => ({ kind: 'invalid', message });

/**
 * Replace a record's cover: check the JPEG, strip its metadata, upload it to B2 under the
 * cover's existing file name (or Rivendell's name for it), and save the link when it changed.
 * A file another record also uses is never overwritten; this record gets its own file instead.
 * Unreachable Rivendell and missing records are rethrown for the error page.
 */
export async function replaceCover(
	deps: { b2: B2Client; pb: CoverTarget },
	def: CollectionDef,
	record: Record<string, unknown> & { id: string },
	bytes: Uint8Array
): Promise<CoverResult> {
	if (bytes.length > MAX_COVER_BYTES) return invalid(COVER_MESSAGES.tooBig);
	if (!isJpeg(bytes)) return invalid(COVER_MESSAGES.notJpeg);
	let stripped: Uint8Array;
	try {
		stripped = stripMetadata(bytes);
	} catch (err) {
		if (err instanceof InvalidJpegError) return invalid(COVER_MESSAGES.notJpeg);
		throw err;
	}

	let url: string;
	try {
		const prefix = await deps.b2.publicPrefix();
		let path = coverPath(def, record, prefix);
		// Match the stored link as well as the rebuilt one: the same B2 file can be spelled with
		// different escapes, and a record holding either form would lose its cover.
		const urls = new Set([publicUrl(prefix, path)]);
		if (typeof record.cover === 'string' && record.cover.startsWith(prefix)) {
			urls.add(record.cover);
		}
		const { items } = await deps.pb.collection(def.name).getList(1, 2, {
			filter: [...urls]
				.reverse()
				.map((url) => `cover = ${JSON.stringify(url)}`)
				.join(' || '),
			fields: 'id'
		});
		if (items.some((item) => item.id !== record.id)) path = ownCoverPath(def, record);
		url = await deps.b2.upload(path, stripped);
	} catch (err) {
		if (err instanceof B2Error) {
			// The page only says "try again"; the cause (bad key, bucket ID, B2 outage) goes here.
			console.error('Cover upload to B2 failed:', err);
			return invalid(COVER_MESSAGES.uploadFailed);
		}
		throw err;
	}

	if (url !== record.cover) {
		const saved = await updateRecord(deps.pb, def, record.id, { cover: url });
		if (saved.kind === 'invalid') return invalid(saved.fields.cover ?? saved.message);
	}
	return { kind: 'updated', url };
}
