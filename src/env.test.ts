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
