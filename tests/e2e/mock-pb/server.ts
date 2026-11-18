/**
 * In-memory stand-in for Rivendell's PocketBase, covering only the endpoints Bruinen calls.
 * Runs with plain `node` (type stripping), so only erasable TypeScript syntax is allowed here.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { seed, type Db } from './seed.ts';

const SUPERUSERS_ID = 'pbc_3142635823';
const ADMIN = { email: 'admin@test.local', password: 'password123' };
const MFA_EMAIL = 'mfa@test.local';

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

function issueToken(): string {
	const payload = {
		id: 'admin000000000a',
		type: 'auth',
		collectionId: SUPERUSERS_ID,
		exp: Math.floor(Date.now() / 1000) + 86_400
	};
	return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.mock`;
}

const superuser = {
	id: 'admin000000000a',
	email: ADMIN.email,
	collectionId: SUPERUSERS_ID,
	collectionName: '_superusers'
};

export interface MockState {
	db: Db;
	tokens: Set<string>;
	delayMs: number;
	down: boolean;
}

export function freshState(): MockState {
	return { db: seed(), tokens: new Set(), delayMs: 0, down: false };
}

function send(res: ServerResponse, status: number, body: unknown) {
	res.writeHead(status, { 'content-type': 'application/json' });
	res.end(JSON.stringify(body));
}

const apiError = (status: number, message: string, data: object = {}) => ({
	status,
	message,
	data
});

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
	let raw = '';
	for await (const chunk of req) raw += chunk;
	if (!raw) return {};
	const type = req.headers['content-type'] ?? '';
	if (type.includes('application/json')) return JSON.parse(raw);
	return Object.fromEntries(new URLSearchParams(raw));
}

function authed(state: MockState, req: IncomingMessage): boolean {
	const header = req.headers.authorization ?? '';
	return state.tokens.has(header.replace(/^Bearer\s+/i, ''));
}

export type RouteHandler = (
	state: MockState,
	req: IncomingMessage,
	res: ServerResponse,
	url: URL,
	body: Record<string, unknown>
) => boolean | Promise<boolean>;

/** Extra routes registered by records.ts; kept separate so this file stays about auth and control. */
export const recordRoutes: RouteHandler[] = [];

export async function handle(state: MockState, req: IncomingMessage, res: ServerResponse) {
	const url = new URL(req.url ?? '/', 'http://mock');
	const body = req.method === 'POST' || req.method === 'PATCH' ? await readJson(req) : {};

	if (url.pathname === '/__mock/reset') {
		Object.assign(state, freshState());
		return send(res, 200, { ok: true });
	}
	if (url.pathname === '/__mock/delay') {
		state.delayMs = Number(body.ms) || 0;
		return send(res, 200, { ok: true });
	}
	if (url.pathname === '/__mock/down') {
		state.down = Boolean(body.down);
		return send(res, 200, { ok: true });
	}
	if (url.pathname === '/api/health')
		return send(res, 200, { code: 200, message: 'API is healthy.' });

	if (state.down) {
		req.socket.destroy();
		return;
	}

	if (req.method === 'POST' && url.pathname === '/api/collections/_superusers/auth-with-password') {
		if (body.identity === MFA_EMAIL) return send(res, 401, { mfaId: 'mfa000000000001' });
		if (body.identity !== ADMIN.email || body.password !== ADMIN.password) {
			return send(res, 400, apiError(400, 'Failed to authenticate.'));
		}
		const token = issueToken();
		state.tokens.add(token);
		return send(res, 200, { token, record: superuser });
	}

	if (req.method === 'POST' && url.pathname === '/api/collections/_superusers/auth-refresh') {
		if (!authed(state, req)) {
			return send(
				res,
				401,
				apiError(401, 'The request requires valid record authorization token.')
			);
		}
		const token = issueToken();
		state.tokens.add(token);
		return send(res, 200, { token, record: superuser });
	}

	if (url.pathname.startsWith('/api/collections/')) {
		if (!authed(state, req) && req.method !== 'POST') {
			return send(res, 403, apiError(403, 'Only superusers can perform this action.'));
		}
		for (const route of recordRoutes) {
			if (await route(state, req, res, url, body)) return;
		}
	}

	send(res, 404, apiError(404, "The requested resource wasn't found."));
}

export function startMockPb(port = 8099) {
	const state = freshState();
	const server = createServer((req, res) => {
		handle(state, req, res).catch((err) => send(res, 500, apiError(500, String(err))));
	});
	return new Promise<{ close: () => Promise<void>; state: MockState }>((resolve) => {
		server.listen(port, '127.0.0.1', () =>
			resolve({ state, close: () => new Promise((done) => server.close(() => done())) })
		);
	});
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const port = Number(process.env.MOCK_PB_PORT ?? 8099);
	await import('./records.ts');
	await startMockPb(port);
	console.log(`mock PocketBase on http://127.0.0.1:${port}`);
}
