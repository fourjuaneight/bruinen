import { error } from '@sveltejs/kit';
import { getCollection } from '#lib/collections.ts';
import { loadMetaOptions } from '#lib/server/meta.ts';
import { buildListOptions, parseListQuery, PER_PAGE } from '#lib/server/query.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const def = getCollection(params.collection);
	if (!def) error(404, 'Not found');

	const query = parseListQuery(url, def);
	const pb = locals.pb;
	const options = buildListOptions(def, query, pb.filter.bind(pb));

	const [list, meta] = await Promise.all([
		pb.collection(def.name).getList(query.page, PER_PAGE, options),
		loadMetaOptions(pb, def)
	]);

	return {
		def,
		query,
		items: list.items,
		page: list.page,
		totalPages: list.totalPages,
		totalItems: list.totalItems,
		meta
	};
};
