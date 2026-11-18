/** Only same-site absolute paths survive; anything else (protocol-relative, external, relative) goes home. */
export function safeNext(next: string | null): string {
	if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
	return next;
}

export function cookieOptions(url: URL) {
	return {
		httpOnly: true,
		sameSite: 'Lax',
		path: '/',
		secure: url.protocol === 'https:'
	} as const;
}
