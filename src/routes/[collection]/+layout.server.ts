import { error } from '@sveltejs/kit';
import { getCollection } from '#lib/collections.ts';
import { loadMetaOptions } from '#lib/server/meta.ts';
import type { LayoutServerLoad } from './$types';

/**
 * What the list and record pages share. It reads only the collection name, so searching, sorting,
 * paging and opening a record reuse it instead of fetching the meta table again.
 */
export const load: LayoutServerLoad = async ({ params, locals }) => {
	const def = getCollection(params.collection);
	if (!def) error(404, 'Not found');
	return { def, meta: await loadMetaOptions(locals.pb, def) };
};
