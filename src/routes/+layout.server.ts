import { COLLECTIONS } from '#lib/collections.ts';
import type { LayoutServerLoad } from './$types';

/**
 * The signed-in user and each collection's record count, for the sidebar and the home page.
 * It reads neither the URL nor params, so navigating never reruns it; saves do (invalidateAll).
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const counts: Record<string, number> = {};
	if (!locals.user) return { user: null, counts };
	try {
		const totals = await Promise.all(
			COLLECTIONS.map((def) =>
				locals.pb
					.collection(def.name)
					.getList(1, 1, { fields: 'id' })
					.then((res) => res.totalItems)
			)
		);
		COLLECTIONS.forEach((def, i) => (counts[def.name] = totals[i]));
	} catch {
		// Counts are a nicety: a page whose own data fails still shows its error inside the shell.
	}
	return { user: locals.user, counts };
};
