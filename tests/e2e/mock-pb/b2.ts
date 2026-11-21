/**
 * Stand-in for Backblaze B2's native API (the three upload calls) and its public file URLs,
 * served by the mock PocketBase server. Runs with plain `node`: erasable TypeScript only.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { MOCK_ORIGIN } from './seed.ts';
import type { MockState } from './server.ts';

export const B2_BUCKET = 'bruinen-covers';
export const B2_FILES = `${MOCK_ORIGIN}/file/${B2_BUCKET}/`;
const KEY = Buffer.from('test-key-id:test-key').toString('base64');
const ACCOUNT_TOKEN = 'b2-account';
const UPLOAD_TOKEN = 'b2-upload';

/** Files the seed's covers point at, as B2 file names. */
export function seedB2(): Map<string, Buffer> {
	const red = readFileSync(new URL('../fixtures/cover-40x60.jpeg', import.meta.url));
	return new Map([
		['Games/Hollow_Knight.jpeg', red],
		['Books/Nineteen_Eighty-Four.jpeg', red]
	]);
}

function send(res: ServerResponse, status: number, body: unknown) {
	res.writeHead(status, { 'content-type': 'application/json' });
	res.end(JSON.stringify(body));
}

const b2Error = (res: ServerResponse, status: number, code: string) =>
	send(res, status, { status, code, message: code });

async function readBody(req: IncomingMessage): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of req) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks);
}

/** Handles B2 routes before the mock reads the body as JSON; false for anything else. */
export async function handleB2(
	state: MockState,
	req: IncomingMessage,
	res: ServerResponse,
	url: URL
): Promise<boolean> {
	const auth = req.headers.authorization ?? '';
	const files = state.b2;

	if (url.pathname === '/__mock/b2-down') {
		state.b2Down = Boolean(JSON.parse((await readBody(req)).toString() || '{}').down);
		send(res, 200, { ok: true });
		return true;
	}

	if (url.pathname === '/__mock/b2') {
		send(res, 200, [...files.keys()]);
		return true;
	}
	if (req.method === 'GET' && url.pathname === '/b2api/v2/b2_authorize_account') {
		if (auth !== `Basic ${KEY}`) b2Error(res, 401, 'unauthorized');
		else
			send(res, 200, {
				apiUrl: MOCK_ORIGIN,
				downloadUrl: MOCK_ORIGIN,
				authorizationToken: ACCOUNT_TOKEN
			});
		return true;
	}
	if (req.method === 'POST' && url.pathname === '/b2api/v1/b2_get_upload_url') {
		const body = JSON.parse((await readBody(req)).toString() || '{}');
		if (auth !== ACCOUNT_TOKEN) b2Error(res, 401, 'expired_auth_token');
		else if (body.bucketId !== 'bucket-test') b2Error(res, 400, 'bad_bucket_id');
		else
			send(res, 200, {
				bucketId: body.bucketId,
				uploadUrl: `${MOCK_ORIGIN}/b2-upload`,
				authorizationToken: UPLOAD_TOKEN
			});
		return true;
	}
	if (req.method === 'POST' && url.pathname === '/b2-upload') {
		const body = await readBody(req);
		const name = decodeURIComponent(String(req.headers['x-bz-file-name'] ?? ''));
		const sha1 = createHash('sha1').update(body).digest('hex');
		if (state.b2Down) b2Error(res, 503, 'service_unavailable');
		else if (auth !== UPLOAD_TOKEN) b2Error(res, 401, 'expired_auth_token');
		else if (!name || req.headers['x-bz-content-sha1'] !== sha1) b2Error(res, 400, 'bad_request');
		else {
			files.set(name, body);
			send(res, 200, { fileName: name, contentSha1: sha1, contentType: 'image/jpeg' });
		}
		return true;
	}
	const prefix = `/file/${B2_BUCKET}/`;
	if (req.method === 'GET' && url.pathname.startsWith(prefix)) {
		const name = decodeURIComponent(url.pathname.slice(prefix.length));
		const file = files.get(name);
		if (!file) send(res, 404, { status: 404, code: 'not_found' });
		else {
			// Long-lived like a CDN-fronted bucket, so tests prove the uploader bypasses the cache.
			res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'max-age=86400' });
			res.end(file);
		}
		return true;
	}
	return false;
}
