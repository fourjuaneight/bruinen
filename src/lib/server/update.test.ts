import { ClientResponseError } from 'pocketbase';
import { describe, expect, it } from 'vitest';
import { getCollection, type CollectionDef } from '../collections.ts';
import { updateRecord, type UpdateTarget } from './update.ts';

const books = getCollection('books') as CollectionDef;

function fake(update?: () => Promise<Record<string, unknown>>) {
	const calls: unknown[][] = [];
	const pb: UpdateTarget = {
		collection: (name) => ({
			update: async (...args: unknown[]) => {
				calls.push([name, ...args]);
				return (update ?? (async () => ({ id: 'b1', title: 'Dune Messiah' })))();
			}
		})
	};
	return { pb, calls };
}

describe('updateRecord', () => {
	it('sends the changes and returns the saved label', async () => {
		const { pb, calls } = fake();
		expect(await updateRecord(pb, books, 'b1', { title: 'Dune Messiah' })).toEqual({
			kind: 'updated',
			label: 'Dune Messiah'
		});
		expect(calls).toEqual([['books', 'b1', { title: 'Dune Messiah' }]]);
	});

	it('sends no request when nothing changed', async () => {
		const { pb, calls } = fake();
		expect(await updateRecord(pb, books, 'b1', {})).toEqual({ kind: 'unchanged' });
		expect(calls).toEqual([]);
	});

	it('maps PocketBase validation errors to field errors', async () => {
		const err = new ClientResponseError({
			status: 400,
			response: { message: 'Failed', data: { genre: { message: 'Invalid relation.' } } }
		});
		const { pb } = fake(() => Promise.reject(err));
		expect(await updateRecord(pb, books, 'b1', { genre: 'x' })).toEqual({
			kind: 'invalid',
			message: 'Please fix the highlighted fields.',
			fields: { genre: 'Invalid relation.' }
		});
	});

	it('rethrows when Rivendell is unreachable or the record is gone', async () => {
		for (const status of [0, 404]) {
			const err = new ClientResponseError({ status, response: {} });
			const { pb } = fake(() => Promise.reject(err));
			await expect(updateRecord(pb, books, 'b1', { title: 'x' })).rejects.toBe(err);
		}
	});
});
