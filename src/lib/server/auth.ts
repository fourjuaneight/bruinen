const BASE = 'http://bruinen.invalid';

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
