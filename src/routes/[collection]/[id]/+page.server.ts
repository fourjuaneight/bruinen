import { error } from '@sveltejs/kit';
import { getCollection } from '#lib/collections.ts';
import type { PageServerLoad } from './$types';

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

	return { def, record, backHref };
};
