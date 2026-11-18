import { afterEach, describe, expect, it } from 'vitest';
import { pocketbaseUrl } from './config.ts';

describe('pocketbaseUrl', () => {
	const original = process.env.POCKETBASE_URL;
	afterEach(() => {
		if (original === undefined) delete process.env.POCKETBASE_URL;
		else process.env.POCKETBASE_URL = original;
	});

	it('defaults to the local PocketBase address', () => {
		delete process.env.POCKETBASE_URL;
		expect(pocketbaseUrl()).toBe('http://127.0.0.1:8090');
	});

	it('strips a trailing slash', () => {
		process.env.POCKETBASE_URL = 'http://x:8090/';
		expect(pocketbaseUrl()).toBe('http://x:8090');
	});
});
