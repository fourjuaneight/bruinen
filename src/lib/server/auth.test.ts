import { describe, expect, it } from 'vitest';
import { cookieOptions, safeNext } from './auth.ts';

describe('safeNext', () => {
	it.each([
		[null, '/'],
		['', '/'],
		['/movies?q=a', '/movies?q=a'],
		['//evil.com', '/'],
		['/\\evil', '/'],
		['https://evil.com', '/'],
		['movies', '/']
	])('%s → %s', (input, expected) => {
		expect(safeNext(input)).toBe(expected);
	});
});

describe('cookieOptions', () => {
	it('marks the cookie Secure behind HTTPS', () => {
		expect(cookieOptions(new URL('https://bruinen.example.ts.net/'))).toEqual({
			httpOnly: true,
			sameSite: 'Lax',
			path: '/',
			secure: true
		});
	});

	it('drops Secure on plain-http localhost so WebKit keeps the cookie', () => {
		expect(cookieOptions(new URL('http://localhost:4173/')).secure).toBe(false);
	});
});
