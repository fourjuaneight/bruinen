import { POCKETBASE_URL } from '$app/env/private';
import { describe, expect, it } from 'vitest';
import { pocketbaseUrl, toB2Config } from './config.ts';

describe('pocketbaseUrl', () => {
	it('returns the POCKETBASE_URL SvelteKit resolved from .env or the environment', () => {
		expect(pocketbaseUrl()).toBe(POCKETBASE_URL);
		expect(pocketbaseUrl()).not.toMatch(/\/$/);
	});
});

describe('toB2Config', () => {
	const env = {
		B2_APP_KEY_ID: 'id',
		B2_APP_KEY: 'secret',
		B2_BUCKET_ID: 'bkt',
		B2_BUCKET_NAME: 'covers',
		B2_API_URL: 'https://api.backblazeb2.com'
	};

	it('builds the config when all four credentials are set', () => {
		expect(toB2Config(env)).toEqual({
			keyId: 'id',
			key: 'secret',
			bucketId: 'bkt',
			bucketName: 'covers',
			apiUrl: 'https://api.backblazeb2.com'
		});
	});

	it('is null when any credential is missing', () => {
		for (const name of ['B2_APP_KEY_ID', 'B2_APP_KEY', 'B2_BUCKET_ID', 'B2_BUCKET_NAME']) {
			expect(toB2Config({ ...env, [name]: '' })).toBeNull();
		}
	});
});
