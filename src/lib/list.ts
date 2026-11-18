import type { CollectionDef } from './collections.ts';

/** List state carried in the URL: `/[collection]?q=&sort=&page=&view=`. */
export interface ListQuery {
	q: string;
	sort: string;
	page: number;
	view: 'table' | 'cards' | null;
}

/** URL for a list view; default values are left out so links stay short and canonical. */
export function listHref(
	def: CollectionDef,
	query: ListQuery,
	overrides: Partial<ListQuery> = {}
): string {
	const next = { ...query, ...overrides };
	const params = new URLSearchParams();
	if (next.q) params.set('q', next.q);
	if (next.sort && next.sort !== def.defaultSort) params.set('sort', next.sort);
	if (next.page > 1) params.set('page', String(next.page));
	if (next.view) params.set('view', next.view);
	const qs = params.toString();
	return qs ? `/${def.name}?${qs}` : `/${def.name}`;
}

/** Clicking a column sorts ascending first, then flips direction. */
export function nextSort(current: string, field: string): string {
	return current === field ? `-${field}` : field;
}

export function sortState(current: string, field: string): 'ascending' | 'descending' | 'none' {
	if (current === field) return 'ascending';
	if (current === `-${field}`) return 'descending';
	return 'none';
}
