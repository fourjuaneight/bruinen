import { afterEach, describe, expect, it } from 'vitest';
import { precache } from './precache.ts';

// A real file on the test server, so the cache can download it.
const SERVED = import.meta.url;
const NAMES = ['precache-test-old', 'precache-test-new'];

async function openCaches() {
	const [old, fresh] = await Promise.all(NAMES.map((name) => caches.open(name)));
	return { old, fresh };
}

const body = async (cache: Cache, path: string) => (await cache.match(path))?.text();

afterEach(async () => {
	await Promise.all(NAMES.map((name) => caches.delete(name)));
});

describe('precache', () => {
	it('copies a hashed file the previous cache already holds instead of downloading it', async () => {
		const { old, fresh } = await openCaches();
		// Not on the server: a download would fail the whole precache.
		await old.put('/_app/immutable/chunks/abc.js', new Response('from the last deploy'));
		await precache(
			fresh,
			['/_app/immutable/chunks/abc.js'],
			new Set(['/_app/immutable/chunks/abc.js']),
			[old]
		);
		expect(await body(fresh, '/_app/immutable/chunks/abc.js')).toBe('from the last deploy');
	});

	it('downloads a file that is not hashed, even when the previous cache holds it', async () => {
		const { old, fresh } = await openCaches();
		await old.put(SERVED, new Response('stale'));
		await precache(fresh, [SERVED], new Set(), [old]);
		expect(await body(fresh, SERVED)).not.toBe('stale');
		expect(await fresh.match(SERVED)).toBeTruthy();
	});

	it('downloads a hashed file no previous cache holds', async () => {
		const { fresh } = await openCaches();
		await precache(fresh, [SERVED], new Set([SERVED]), []);
		expect(await fresh.match(SERVED)).toBeTruthy();
	});
});
