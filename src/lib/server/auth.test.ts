import { ClientResponseError } from 'pocketbase';
import { describe, expect, it } from 'vitest';
import { cookieOptions, refreshSession, safeNext, type SessionTarget } from './auth.ts';

const HOUR = 3600;
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const tokenExpiringIn = (seconds: number) =>
	`${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + seconds })}.sig`;

/** A client whose session holds `token`; authRefresh resolves, or rejects with `refreshError`. */
function session(token: string, opts: { superuser?: boolean; refreshError?: unknown } = {}) {
	const calls = { refresh: 0 };
	const pb = {
		authStore: {
			token,
			isValid: true,
			isSuperuser: opts.superuser ?? true,
			clear() {
				this.token = '';
				this.isValid = false;
			}
		},
		collection: () => ({
			authRefresh: async () => {
				calls.refresh++;
				if (opts.refreshError) throw opts.refreshError;
			}
		})
	} satisfies SessionTarget;
	return { pb, calls };
}

describe('refreshSession', () => {
	it('leaves a token with more than 23 hours left alone, without calling PocketBase', async () => {
		const { pb, calls } = session(tokenExpiringIn(24 * HOUR - 60));
		await refreshSession(pb);
		expect(calls.refresh).toBe(0);
		expect(pb.authStore.isValid).toBe(true);
	});

	it('refreshes a token with less than 23 hours left', async () => {
		const { pb, calls } = session(tokenExpiringIn(22 * HOUR));
		await refreshSession(pb);
		expect(calls.refresh).toBe(1);
	});

	it('signs out when PocketBase refuses the refresh', async () => {
		const refreshError = new ClientResponseError({ status: 401 });
		const { pb } = session(tokenExpiringIn(HOUR), { refreshError });
		await refreshSession(pb);
		expect(pb.authStore.isValid).toBe(false);
	});

	it('keeps the session when Rivendell is unreachable', async () => {
		const refreshError = new ClientResponseError({ status: 0 });
		const { pb } = session(tokenExpiringIn(HOUR), { refreshError });
		await refreshSession(pb);
		expect(pb.authStore.isValid).toBe(true);
	});

	it('clears a session that is not a superuser one', async () => {
		const { pb, calls } = session(tokenExpiringIn(24 * HOUR), { superuser: false });
		await refreshSession(pb);
		expect(calls.refresh).toBe(0);
		expect(pb.authStore.isValid).toBe(false);
	});
});

describe('safeNext', () => {
	it.each([
		[null, '/'],
		['', '/'],
		['/movies?q=a', '/movies?q=a'],
		['//evil.com', '/'],
		['/\\evil', '/'],
		['https://evil.com', '/'],
		['movies', '/'],
		// Browsers strip tabs and newlines from URLs, turning these into //evil.com.
		['/\t/evil.com', '/'],
		['/\n/evil.com', '/'],
		['/movies?q=a#top', '/movies?q=a#top']
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
