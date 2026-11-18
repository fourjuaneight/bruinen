import { ClientResponseError } from 'pocketbase';
import { describe, expect, it } from 'vitest';
import { getCollection, type CollectionDef } from '../collections.ts';
import { createRecord, type CreateTarget } from './create.ts';
import { longFetch } from './pb.ts';

const movies = getCollection('movies') as CollectionDef;
const videos = getCollection('videos') as CollectionDef;
const generic = () =>
	new ClientResponseError({
		status: 400,
		response: { message: 'Something went wrong while processing your request.', data: {} }
	});

interface FakeOptions {
	create?: () => Promise<{ id: string; [k: string]: unknown }>;
	/** ids returned by successive "latest record with this key" lookups */
	latest?: (string | undefined)[];
}

function fake({ create, latest = [] }: FakeOptions) {
	const calls: { create: unknown[][]; lookups: unknown[][] } = { create: [], lookups: [] };
	const pb: CreateTarget = {
		filter: (expr, params) => `${expr}|${JSON.stringify(params)}`,
		collection: () => ({
			create: async (...args: unknown[]) => {
				calls.create.push(args);
				return (create ?? (async () => ({ id: 'new1', title: 'Arrival' })))();
			},
			getList: async (...args: unknown[]) => {
				calls.lookups.push(args);
				const id = latest.shift();
				return { items: id ? [{ id }] : [] };
			}
		})
	};
	return { pb, calls };
}

describe('createRecord', () => {
	it('returns the new record id and label', async () => {
		const { pb } = fake({});
		expect(await createRecord(pb, movies, { title: 'Arrival' })).toEqual({
			kind: 'created',
			id: 'new1',
			label: 'Arrival'
		});
	});

	it('reports a record saved without enrichment after an opaque error', async () => {
		const { pb } = fake({ create: () => Promise.reject(generic()), latest: [undefined, 'saved1'] });
		expect(await createRecord(pb, movies, { title: 'Arrival' })).toEqual({
			kind: 'saved-unenriched',
			id: 'saved1',
			label: 'Arrival'
		});
	});

	it('does not mistake an older record with the same key for the new one', async () => {
		const { pb } = fake({ create: () => Promise.reject(generic()), latest: ['old1', 'old1'] });
		expect(await createRecord(pb, movies, { title: 'Arrival' })).toEqual({
			kind: 'invalid',
			message: 'Rivendell rejected this record. Check the values and try again.',
			fields: {}
		});
	});

	it('treats a timeout as still processing', async () => {
		const timeout = new ClientResponseError({
			status: 0,
			originalError: new DOMException('timed out', 'TimeoutError')
		});
		const { pb } = fake({ create: () => Promise.reject(timeout) });
		expect(await createRecord(pb, videos, { url: 'https://youtu.be/x' })).toEqual({
			kind: 'pending'
		});
	});

	it('uses the long-timeout fetch only for slow collections', async () => {
		const slow = fake({});
		await createRecord(slow.pb, videos, { url: 'https://youtu.be/x' });
		expect(slow.calls.create[0][1]).toEqual({ fetch: longFetch });

		const fast = fake({});
		await createRecord(fast.pb, movies, { title: 'Arrival' });
		expect(fast.calls.create[0][1]).toBeUndefined();
	});

	it('looks the record up by its key field, newest first', async () => {
		const { pb, calls } = fake({});
		await createRecord(pb, videos, { url: 'https://youtu.be/x' });
		expect(calls.lookups[0]).toEqual([
			1,
			1,
			{ filter: 'url = {:v}|{"v":"https://youtu.be/x"}', sort: '-@rowid', fields: 'id' }
		]);
	});
});
