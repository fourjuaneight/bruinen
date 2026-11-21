import { redirect } from '@sveltejs/kit';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { cookieOptions, refreshSession } from '#lib/server/auth.ts';
import { AUTH_COOKIE, createPb, toHttpError } from '#lib/server/pb.ts';

const PUBLIC_PATHS = new Set(['/login']);

export const handle: Handle = async ({ event, resolve }) => {
	const pb = createPb();
	pb.authStore.loadFromCookie(event.request.headers.get('cookie') ?? '', AUTH_COOKIE);
	const token = pb.authStore.token;
	await refreshSession(pb);

	event.locals.pb = pb;
	const record = pb.authStore.record;
	event.locals.user = record ? { id: record.id, email: String(record.email ?? '') } : null;

	if (!event.locals.user && !PUBLIC_PATHS.has(event.url.pathname)) {
		const next = event.url.pathname + event.url.search;
		redirect(303, `/login?next=${encodeURIComponent(next)}`);
	}

	const response = await resolve(event);
	// Only a sign-in, refresh, sign-out or rejected session changes the cookie.
	if (pb.authStore.token !== token) {
		response.headers.append(
			'set-cookie',
			pb.authStore.exportToCookie(cookieOptions(event.url), AUTH_COOKIE)
		);
	}
	return response;
};

export const handleError: HandleServerError = ({ kind, error, event }) => {
	if (kind !== 'unknown') return;
	console.error(error);
	const shaped = toHttpError(error);
	// Rivendell refused the token (revoked before it expired): drop it so the next page signs in.
	if (shaped.status === 401) event.locals.pb?.authStore.clear();
	return shaped;
};
