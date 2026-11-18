import type { CollectionDef } from '../collections.ts';
import type { ListQuery } from '../list.ts';

export type { ListQuery };

export const PER_PAGE = 30;

type FilterFn = (expr: string, params: Record<string, unknown>) => string;

function parseSort(raw: string | null, def: CollectionDef): string {
	if (!raw) return def.defaultSort;
	const field = raw.startsWith('-') ? raw.slice(1) : raw;
	return def.sortable.includes(field) ? raw : def.defaultSort;
}

function parsePage(raw: string | null): number {
	const page = Number(raw);
	return Number.isInteger(page) && page >= 1 ? page : 1;
}

function parseView(raw: string | null, def: CollectionDef): ListQuery['view'] {
	if (raw === 'table') return 'table';
	if (raw === 'cards' && def.image) return 'cards';
	return null;
}

/** Read list state from the URL; anything invalid falls back to a default instead of erroring. */
export function parseListQuery(url: URL, def: CollectionDef): ListQuery {
	const params = url.searchParams;
	return {
		q: (params.get('q') ?? '').trim(),
		sort: parseSort(params.get('sort'), def),
		page: parsePage(params.get('page')),
		view: parseView(params.get('view'), def)
	};
}

/** PocketBase list options; `filter` is pb.filter so user text is always escaped by the SDK. */
export function buildListOptions(
	def: CollectionDef,
	query: ListQuery,
	filter: FilterFn
): { sort: string; filter?: string; expand?: string } {
	const expr = def.searchFields.map((field) => `${field} ~ {:q}`).join(' || ');
	return {
		sort: query.sort,
		filter: query.q ? filter(expr, { q: query.q }) : undefined,
		expand: def.expand.length ? def.expand.join(',') : undefined
	};
}
