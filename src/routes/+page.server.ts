import { COLLECTIONS } from '#lib/collections.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const counts = await Promise.all(
		COLLECTIONS.map((def) =>
			locals.pb
				.collection(def.name)
				.getList(1, 1, { fields: 'id' })
				.then((res) => res.totalItems)
		)
	);
	return {
		collections: COLLECTIONS.map((def, i) => ({
			name: def.name,
			label: def.label,
			count: counts[i]
		}))
	};
};
