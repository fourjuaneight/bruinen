import { error, fail } from '@sveltejs/kit';
import { getCollection } from '#lib/collections.ts';
import { createRecord } from '#lib/server/create.ts';
import { buildPayload, formValues } from '#lib/server/payload.ts';
import { buildListOptions, parseListQuery, PER_PAGE } from '#lib/server/query.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const def = getCollection(params.collection);
	if (!def) error(404, 'Not found');

	const query = parseListQuery(url, def);
	const pb = locals.pb;
	const options = buildListOptions(def, query, pb.filter.bind(pb));
	const list = await pb.collection(def.name).getList(query.page, PER_PAGE, options);

	return {
		query,
		items: list.items,
		page: list.page,
		totalPages: list.totalPages,
		totalItems: list.totalItems
	};
};

export const actions: Actions = {
	create: async ({ params, request, locals }) => {
		const def = getCollection(params.collection);
		if (!def) error(404, 'Not found');

		const form = await request.formData();
		const values = formValues(def, form);
		const { data, errors } = buildPayload(def, form);
		if (Object.keys(errors).length) {
			return fail(400, { message: 'Please fix the highlighted fields.', fields: errors, values });
		}

		const result = await createRecord(locals.pb, def, data);
		if (result.kind === 'invalid') {
			return fail(400, { message: result.message, fields: result.fields, values });
		}
		if (result.kind === 'pending') return fail(504, { pending: true });
		return { result };
	}
};
