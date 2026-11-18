import { POCKETBASE_URL } from '$app/env/private';
import { describe, expect, it } from 'vitest';
import { pocketbaseUrl } from './config.ts';

describe('pocketbaseUrl', () => {
	it('returns the POCKETBASE_URL SvelteKit resolved from .env or the environment', () => {
		expect(pocketbaseUrl()).toBe(POCKETBASE_URL);
		expect(pocketbaseUrl()).not.toMatch(/\/$/);
	});
});
