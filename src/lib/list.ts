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

export interface SortOption {
	value: string;
	label: string;
}

const DATE_LIKE = new Set(['year', 'start', 'end']);

/** The words for each direction of a field: dates read as time, numbers as size, text as A–Z. */
function directions(
	def: CollectionDef,
	field: string
): { label: string; up: string; down: string } {
	const column = def.columns.find((c) => c.name === field);
	const numeric = column?.type === 'number' || column?.type === 'date';
	const [up, down] = DATE_LIKE.has(field)
		? ['oldest first', 'newest first']
		: numeric
			? ['low to high', 'high to low']
			: ['A–Z', 'Z–A'];
	return { label: column?.label ?? field, up, down };
}

/** The sort select's options: the default order, then each sortable field both ways. */
export function sortOptions(def: CollectionDef): SortOption[] {
	const options: SortOption[] = [
		{
			value: def.defaultSort,
			label: def.defaultSort === '-@rowid' ? 'Recently added' : 'Default order'
		}
	];
	for (const field of def.sortable) {
		const { label, up, down } = directions(def, field);
		for (const [value, dir] of [
			[field, up],
			[`-${field}`, down]
		]) {
			if (value !== def.defaultSort) options.push({ value, label: `${label} (${dir})` });
		}
	}
	return options;
}

/** The table caption: "Articles, sorted by year, newest first". */
export function sortCaption(def: CollectionDef, sort: string): string {
	if (sort === '-@rowid') return `${def.label}, most recently added first`;
	const field = sort.replace(/^-/, '');
	const { label, up, down } = directions(def, field);
	return `${def.label}, sorted by ${label.toLowerCase()}, ${sort.startsWith('-') ? down : up}`;
}
