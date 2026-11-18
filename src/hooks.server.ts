import { redirect } from '@sveltejs/kit';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { ClientResponseError } from 'pocketbase';
import { cookieOptions } from '#lib/server/auth.ts';
import { AUTH_COOKIE, createPb, toHttpError } from '#lib/server/pb.ts';

const PUBLIC_PATHS = new Set(['/login']);

export const handle: Handle = async ({ event, resolve }) => {
	const pb = createPb();
	pb.authStore.loadFromCookie(event.request.headers.get('cookie') ?? '', AUTH_COOKIE);

	if (pb.authStore.isValid && pb.authStore.isSuperuser) {
		try {
			await pb.collection('_superusers').authRefresh();
		} catch (err) {
			// Rivendell being down is not a reason to log out: keep the session and let the
			// page's own request fail with a 503 instead of bouncing the user to the login form.
			const unreachable = err instanceof ClientResponseError && err.status === 0;
			if (!unreachable) pb.authStore.clear();
		}
	} else {
		pb.authStore.clear();
	}

	event.locals.pb = pb;
	const record = pb.authStore.record;
	event.locals.user = record ? { id: record.id, email: String(record.email ?? '') } : null;

	if (!event.locals.user && !PUBLIC_PATHS.has(event.url.pathname)) {
		const next = event.url.pathname + event.url.search;
		redirect(303, `/login?next=${encodeURIComponent(next)}`);
	}

	const response = await resolve(event);
	response.headers.append(
		'set-cookie',
		pb.authStore.exportToCookie(cookieOptions(event.url), AUTH_COOKIE)
	);
	return response;
};

export const handleError: HandleServerError = ({ kind, error }) => {
	if (kind !== 'unknown') return;
	console.error(error);
	return toHttpError(error);
};
