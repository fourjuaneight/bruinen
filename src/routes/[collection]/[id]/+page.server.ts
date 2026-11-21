import { error, fail } from '@sveltejs/kit';
import { getCollection } from '#lib/collections.ts';
import { COVER_MESSAGES } from '#lib/covers.ts';
import { b2 } from '#lib/server/b2.ts';
import { replaceCover } from '#lib/server/cover.ts';
import { resolveMetaIds } from '#lib/server/meta.ts';
import { buildUpdate, formValues } from '#lib/server/payload.ts';
import { updateRecord } from '#lib/server/update.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, request, url }) => {
	const def = getCollection(params.collection);
	if (!def) error(404, 'Not found');

	const record = await locals.pb.collection(def.name).getOne(params.id, {
		expand: def.expand.length ? def.expand.join(',') : undefined
	});

	// Return to the exact list the user came from (search, sort, page, view), but only for
	// a same-origin referrer pointing at this collection's list.
	let backHref = `/${def.name}`;
	const referer = request.headers.get('referer');
	if (referer) {
		const from = new URL(referer, url);
		if (from.origin === url.origin && from.pathname === `/${def.name}`) {
			backHref = from.pathname + from.search;
		}
	}

	return { record, backHref, canUploadCover: def.image === 'cover' && b2() !== null };
};

export const actions: Actions = {
	update: async ({ params, request, locals }) => {
		const def = getCollection(params.collection);
		if (!def) error(404, 'Not found');

		const pb = locals.pb;
		const form = await request.formData();
		const values = formValues(def, form, def.edit);
		const current = await pb.collection(def.name).getOne(params.id, {
			expand: def.expand.length ? def.expand.join(',') : undefined
		});

		const changes = buildUpdate(def, form, current);
		if (Object.keys(changes.errors).length) {
			return fail(400, {
				message: 'Please fix the highlighted fields.',
				fields: changes.errors,
				values
			});
		}
		const resolved = await resolveMetaIds(pb, def, changes.data, current);
		if (Object.keys(resolved.errors).length) {
			return fail(400, {
				message: 'Please fix the highlighted fields.',
				fields: resolved.errors,
				values
			});
		}

		const updated = await updateRecord(pb, def, params.id, resolved.data);
		if (updated.kind === 'invalid') {
			return fail(400, { message: updated.message, fields: updated.fields, values });
		}
		return { updated };
	},

	cover: async ({ params, request, locals }) => {
		const def = getCollection(params.collection);
		const client = b2();
		if (!def || def.image !== 'cover' || !client) error(404, 'Not found');

		const form = await request.formData();
		const file = form.get('cover');
		if (!(file instanceof File) || !file.size) {
			return fail(400, { cover: { message: COVER_MESSAGES.notJpeg } });
		}
		const record = await locals.pb.collection(def.name).getOne(params.id);
		const bytes = new Uint8Array(await file.arrayBuffer());
		const result = await replaceCover({ b2: client, pb: locals.pb }, def, record, bytes);
		if (result.kind === 'invalid') return fail(400, { cover: { message: result.message } });
		return { cover: result };
	}
};
