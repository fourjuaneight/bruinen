import { ClientResponseError, isTokenExpired } from 'pocketbase';

const BASE = 'http://bruinen.invalid';

/**
 * Refresh only tokens with less than this left. PocketBase checks the token on every call anyway,
 * so refreshing on each request only cost a round trip. With the default one-day superuser token
 * this refreshes at most once an hour, and a session still lasts 23 hours past its last request.
 */
const REFRESH_WITHIN_S = 23 * 3600;

/** The slice of the PocketBase client refreshSession uses, so tests can pass a fake. */
export interface SessionTarget {
	authStore: { token: string; isValid: boolean; isSuperuser: boolean; clear(): void };
	collection(name: string): { authRefresh(): Promise<unknown> };
}

/** Keep a superuser session alive, or clear anything else. Rivendell being down keeps it. */
export async function refreshSession(pb: SessionTarget): Promise<void> {
	const store = pb.authStore;
	if (!store.isValid || !store.isSuperuser) return store.clear();
	if (!isTokenExpired(store.token, REFRESH_WITHIN_S)) return;
	try {
		await pb.collection('_superusers').authRefresh();
	} catch (err) {
		// Rivendell being down is not a reason to log out: keep the session and let the
		// page's own request fail with a 503 instead of bouncing the user to the login form.
		const unreachable = err instanceof ClientResponseError && err.status === 0;
		if (!unreachable) store.clear();
	}
}

/**
 * Only same-origin absolute paths survive; anything else (protocol-relative, external, relative)
 * goes home. Resolving with URL applies the browser's own rules, which strip tabs and newlines
 * that would otherwise turn "/\t/evil.com" into "//evil.com".
 */
export function safeNext(next: string | null): string {
	if (!next || !next.startsWith('/')) return '/';
	let url: URL;
	try {
		url = new URL(next, BASE);
	} catch {
		return '/';
	}
	return url.origin === BASE ? url.pathname + url.search + url.hash : '/';
}

export function cookieOptions(url: URL) {
	return {
		httpOnly: true,
		sameSite: 'Lax',
		path: '/',
		secure: url.protocol === 'https:'
	} as const;
}
