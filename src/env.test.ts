import { describe, expect, it } from 'vitest';
import { variables } from './env.ts';

const validate = (value: string | undefined) =>
	variables.POCKETBASE_URL.schema['~standard'].validate(value) as { value?: unknown };

describe('POCKETBASE_URL', () => {
	it('defaults to the local PocketBase address', () => {
		expect(validate(undefined).value).toBe('http://127.0.0.1:8090');
		expect(validate('').value).toBe('http://127.0.0.1:8090');
	});

	it('strips a trailing slash', () => {
		expect(validate('https://rivendell.example.ts.net/').value).toBe(
			'https://rivendell.example.ts.net'
		);
	});
});

describe('B2 variables', () => {
	const check = (name: keyof typeof variables, value: string | undefined) =>
		(variables[name].schema['~standard'].validate(value) as { value?: unknown }).value;

	it('default the credentials to empty, so cover upload stays off', () => {
		for (const name of ['B2_APP_KEY_ID', 'B2_APP_KEY', 'B2_BUCKET_ID', 'B2_BUCKET_NAME'] as const) {
			expect(check(name, undefined)).toBe('');
		}
	});

	it('default B2_API_URL to Backblaze and strip a trailing slash', () => {
		expect(check('B2_API_URL', undefined)).toBe('https://api.backblazeb2.com');
		expect(check('B2_API_URL', 'http://127.0.0.1:8099/')).toBe('http://127.0.0.1:8099');
	});
});
