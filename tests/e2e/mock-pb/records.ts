import type { ServerResponse } from 'node:http';
import { recordRoutes } from './routes.ts';
import type { MockState } from './server.ts';
import type { MockRecord } from './seed.ts';

// 1x1 transparent PNG.
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

const RELATIONS = ['genre', 'status', 'definition', 'platform', 'tags'];

function json(res: ServerResponse, status: number, body: unknown) {
	res.writeHead(status, { 'content-type': 'application/json' });
	res.end(JSON.stringify(body));
}

function metaById(state: MockState, metaId: unknown) {
	return state.db.meta.find((r) => r.id === metaId);
}

/** Text value of `path` on a record; `genre.name` follows the relation into meta. */
function valuesAt(state: MockState, record: MockRecord, path: string): string[] {
	const [field, sub] = path.split('.');
	const raw = record[field];
	if (sub) {
		const ids = Array.isArray(raw) ? raw : [raw];
		return ids.map((metaId) => String(metaById(state, metaId)?.[sub] ?? ''));
	}
	return [String(raw ?? '')];
}

const TERM = /([\w.@]+)\s*(~|=)\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;

/** Supports the filters Bruinen sends: `a ~ "x" || b ~ "x"` (contains) and `a = "x"` (equals). */
function matches(state: MockState, record: MockRecord, filter: string): boolean {
	const terms = [...filter.matchAll(TERM)];
	if (!terms.length) return true;
	return terms.some(([, path, op, single, double]) => {
		const value = (single ?? double).replace(/\\(.)/g, '$1');
		return valuesAt(state, record, path).some((v) =>
			op === '~' ? v.toLowerCase().includes(value.toLowerCase()) : v === value
		);
	});
}

function sortRecords(records: MockRecord[], sort: string): MockRecord[] {
	if (!sort) return records;
	const desc = sort.startsWith('-');
	const field = desc ? sort.slice(1) : sort;
	const key = (r: MockRecord) => (field === '@rowid' ? r.rowid : r[field]);
	return [...records].sort((a, b) => {
		const [x, y] = [key(a), key(b)];
		const cmp =
			typeof x === 'number' && typeof y === 'number'
				? x - y
				: String(x ?? '').localeCompare(String(y ?? ''));
		return desc ? -cmp : cmp;
	});
}

export function present(
	state: MockState,
	collection: string,
	record: MockRecord,
	expand: string[]
) {
	const { rowid, ...fields } = record;
	void rowid;
	const out: Record<string, unknown> = {
		collectionId: `pbc_${collection}`,
		collectionName: collection,
		...fields
	};
	const expanded: Record<string, unknown> = {};
	for (const field of expand.filter((f) => RELATIONS.includes(f))) {
		const raw = record[field];
		if (Array.isArray(raw)) expanded[field] = raw.map((v) => metaById(state, v)).filter(Boolean);
		else if (raw) expanded[field] = metaById(state, raw);
	}
	if (Object.keys(expanded).length) out.expand = expanded;
	return out;
}

const LIST = /^\/api\/collections\/([\w]+)\/records$/;
const ONE = /^\/api\/collections\/([\w]+)\/records\/([\w]+)$/;

recordRoutes.push(async (state, req, res, url) => {
	if (url.pathname.startsWith('/covers/')) {
		if (url.pathname === '/covers/ok.png') {
			res.writeHead(200, { 'content-type': 'image/png' });
			res.end(PNG);
		} else json(res, 404, {});
		return true;
	}

	const expand = (url.searchParams.get('expand') ?? '').split(',').filter(Boolean);

	const list = url.pathname.match(LIST);
	if (list && req.method === 'GET') {
		const rows = state.db[list[1]];
		if (!rows)
			return (
				json(res, 404, { status: 404, message: 'Missing collection context.', data: {} }),
				true
			);
		const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
		const perPage = Math.max(1, Number(url.searchParams.get('perPage') ?? 30));
		const filtered = sortRecords(
			rows.filter((r) => matches(state, r, url.searchParams.get('filter') ?? '')),
			url.searchParams.get('sort') ?? ''
		);
		const totalItems = filtered.length;
		json(res, 200, {
			page,
			perPage,
			totalItems,
			totalPages: Math.ceil(totalItems / perPage),
			items: filtered
				.slice((page - 1) * perPage, page * perPage)
				.map((r) => present(state, list[1], r, expand))
		});
		return true;
	}

	const one = url.pathname.match(ONE);
	if (one && req.method === 'GET') {
		const record = state.db[one[1]]?.find((r) => r.id === one[2]);
		if (!record)
			json(res, 404, { status: 404, message: "The requested resource wasn't found.", data: {} });
		else json(res, 200, present(state, one[1], record, expand));
		return true;
	}

	return false;
});
