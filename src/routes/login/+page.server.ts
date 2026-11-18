import { fail, redirect } from '@sveltejs/kit';
import { ClientResponseError } from 'pocketbase';
import { safeNext } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');

		try {
			await locals.pb.collection('_superusers').authWithPassword(email, password);
		} catch (err) {
			if (err instanceof ClientResponseError && err.response?.mfaId) {
				return fail(401, {
					message: 'This account requires MFA, which Bruinen does not support yet',
					email
				});
			}
			if (err instanceof ClientResponseError && err.status === 400) {
				return fail(400, { message: 'Wrong email or password', email });
			}
			throw err;
		}

		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
