import { ClientResponseError } from 'pocketbase';
import { describe, expect, it } from 'vitest';
import { jpeg } from '../../../tests/fixtures/jpeg.ts';
import { getCollection, type CollectionDef } from '../collections.ts';
import { COVER_MESSAGES, MAX_COVER_BYTES } from '../covers.ts';
import { B2Error, type B2Client } from './b2.ts';
import { replaceCover, type CoverTarget } from './cover.ts';
import { stripMetadata } from './jpeg.ts';

const books = getCollection('books') as CollectionDef;
const P = 'https://dl.example/file/covers/';
const BYTES = jpeg([]);
const PNG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

function fakes(
	opts: {
		upload?: () => Promise<void>;
		update?: () => Promise<Record<string, unknown>>;
		others?: { id: string }[];
	} = {}
) {
	const uploads: [string, Uint8Array][] = [];
	const lists: unknown[][] = [];
	const updates: unknown[][] = [];
	const b2: B2Client = {
		publicPrefix: async () => P,
		upload: async (path, bytes) => {
			uploads.push([path, bytes]);
			await opts.upload?.();
			return P + path.split('/').map(encodeURIComponent).join('/');
		}
	};
	const pb: CoverTarget = {
		collection: (name) => ({
			getList: async (...args: unknown[]) => {
				lists.push([name, ...args]);
				return { items: opts.others ?? [] };
			},
			update: async (...args: unknown[]) => {
				updates.push([name, ...args]);
				return (opts.update ?? (async () => ({ id: 'b1', title: 'Dune' })))();
			}
		})
	};
	return { deps: { b2, pb }, uploads, lists, updates };
}

const dune = (cover = '') => ({ id: 'b1', title: 'Dune', cover });

describe('replaceCover', () => {
	it('uploads the stripped file and saves its URL', async () => {
		const { deps, uploads, updates } = fakes();
		const result = await replaceCover(deps, books, dune(), BYTES);
		expect(uploads).toEqual([['Books/Dune.jpeg', stripMetadata(BYTES)]]);
		expect(updates).toEqual([['books', 'b1', { cover: P + 'Books/Dune.jpeg' }]]);
		expect(result).toEqual({ kind: 'updated', url: P + 'Books/Dune.jpeg' });
	});

	it('replaces in place without a record update when the URL is unchanged', async () => {
		const { deps, uploads, updates } = fakes();
		const result = await replaceCover(deps, books, dune(P + 'Books/Dune.jpeg'), BYTES);
		expect(uploads.map(([path]) => path)).toEqual(['Books/Dune.jpeg']);
		expect(updates).toEqual([]);
		expect(result).toEqual({ kind: 'updated', url: P + 'Books/Dune.jpeg' });
	});

	it('checks for other records using the URL', async () => {
		const { deps, lists } = fakes();
		await replaceCover(deps, books, dune(), BYTES);
		expect(lists).toEqual([
			['books', 1, 2, { filter: `cover = ${JSON.stringify(P + 'Books/Dune.jpeg')}`, fields: 'id' }]
		]);
	});

	it('uses its own file when another record shares the cover', async () => {
		const shared = fakes({ others: [{ id: 'b1' }, { id: 'b2' }] });
		await replaceCover(shared.deps, books, dune(P + 'Books/Dune.jpeg'), BYTES);
		expect(shared.uploads.map(([path]) => path)).toEqual(['Books/Dune-b1.jpeg']);
		expect(shared.updates).toEqual([['books', 'b1', { cover: P + 'Books/Dune-b1.jpeg' }]]);

		const alone = fakes({ others: [{ id: 'b1' }] });
		await replaceCover(alone.deps, books, dune(P + 'Books/Dune.jpeg'), BYTES);
		expect(alone.uploads.map(([path]) => path)).toEqual(['Books/Dune.jpeg']);
	});

	it('refuses non-JPEG, oversized and unparseable files before uploading', async () => {
		const tooBig = new Uint8Array(MAX_COVER_BYTES + 1);
		tooBig.set([0xff, 0xd8, 0xff]);
		const garbage = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3);
		const cases: [Uint8Array, string][] = [
			[PNG, COVER_MESSAGES.notJpeg],
			[tooBig, COVER_MESSAGES.tooBig],
			[garbage, COVER_MESSAGES.notJpeg]
		];
		for (const [bytes, message] of cases) {
			const { deps, uploads, lists } = fakes();
			expect(await replaceCover(deps, books, dune(), bytes)).toEqual({ kind: 'invalid', message });
			expect(uploads).toEqual([]);
			expect(lists).toEqual([]);
		}
	});

	it('reports a B2 failure without touching the record', async () => {
		const { deps, updates } = fakes({ upload: () => Promise.reject(new B2Error('down')) });
		expect(await replaceCover(deps, books, dune(), BYTES)).toEqual({
			kind: 'invalid',
			message: COVER_MESSAGES.uploadFailed
		});
		expect(updates).toEqual([]);

		const noAuth = fakes();
		noAuth.deps.b2.publicPrefix = () => Promise.reject(new B2Error('bad key', 401));
		expect(await replaceCover(noAuth.deps, books, dune(), BYTES)).toEqual({
			kind: 'invalid',
			message: COVER_MESSAGES.uploadFailed
		});
	});

	it('reports a record update failure', async () => {
		// The cover field's own error is the useful part; otherwise Rivendell's generic message.
		const badUrl = new ClientResponseError({
			status: 400,
			response: { message: 'Failed', data: { cover: { message: 'Must be a valid url.' } } }
		});
		const rejected = fakes({ update: () => Promise.reject(badUrl) });
		expect(await replaceCover(rejected.deps, books, dune(), BYTES)).toEqual({
			kind: 'invalid',
			message: 'Must be a valid url.'
		});
		const bad = new ClientResponseError({ status: 400, response: { message: 'Failed', data: {} } });
		const { deps } = fakes({ update: () => Promise.reject(bad) });
		expect(await replaceCover(deps, books, dune(), BYTES)).toEqual({
			kind: 'invalid',
			message: 'Rivendell rejected this record. Check the values and try again.'
		});

		const gone = new ClientResponseError({ status: 404, response: {} });
		const missing = fakes({ update: () => Promise.reject(gone) });
		await expect(replaceCover(missing.deps, books, dune(), BYTES)).rejects.toBe(gone);
	});
});
