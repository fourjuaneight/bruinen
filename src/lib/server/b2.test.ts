import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { B2Error, createB2, type B2Config } from './b2.ts';

const config: B2Config = {
	keyId: 'id',
	key: 'secret',
	bucketId: 'bkt',
	bucketName: 'covers',
	apiUrl: 'https://api.example'
};
const BYTES = Uint8Array.of(0xff, 0xd8, 0xff, 1, 2, 3);

interface Call {
	method: string;
	url: string;
	headers: Record<string, string>;
	body?: unknown;
}

type Reply = { status: number; body: unknown } | Error;

/** A fake fetch answering B2's three calls; `script` overrides replies per call, in order. */
function fakeB2(script: Partial<Record<'auth' | 'uploadUrl' | 'upload', Reply[]>> = {}) {
	const calls: Call[] = [];
	const defaults: Record<string, Reply> = {
		auth: {
			status: 200,
			body: {
				apiUrl: 'https://api002.example',
				authorizationToken: 'acct-token',
				downloadUrl: 'https://dl.example'
			}
		},
		uploadUrl: {
			status: 200,
			body: { uploadUrl: 'https://up.example/u1', authorizationToken: 'up-token' }
		},
		upload: { status: 200, body: { fileName: 'x' } }
	};
	const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input);
		const headers = Object.fromEntries(new Headers(init?.headers).entries());
		calls.push({ method: init?.method ?? 'GET', url, headers, body: init?.body });
		const kind = url.includes('b2_authorize_account')
			? 'auth'
			: url.includes('b2_get_upload_url')
				? 'uploadUrl'
				: 'upload';
		const reply = script[kind]?.shift() ?? defaults[kind];
		if (reply instanceof Error) throw reply;
		return new Response(JSON.stringify(reply.body), { status: reply.status });
	}) as typeof fetch;
	return { fetchFn, calls };
}

const expired = { status: 401, body: { status: 401, code: 'expired_auth_token', message: 'x' } };

describe('createB2', () => {
	it('authorizes with Basic keyId:key', async () => {
		const { fetchFn, calls } = fakeB2();
		await createB2(config, fetchFn).upload('Books/Dune.jpeg', BYTES);
		expect(calls[0].method).toBe('GET');
		expect(calls[0].url).toBe('https://api.example/b2api/v2/b2_authorize_account');
		expect(calls[0].headers.authorization).toBe(
			'Basic ' + Buffer.from('id:secret').toString('base64')
		);
	});

	it('gets an upload URL for the bucket', async () => {
		const { fetchFn, calls } = fakeB2();
		await createB2(config, fetchFn).upload('Books/Dune.jpeg', BYTES);
		expect(calls[1]).toMatchObject({
			method: 'POST',
			url: 'https://api002.example/b2api/v1/b2_get_upload_url',
			headers: { authorization: 'acct-token' },
			body: '{"bucketId":"bkt"}'
		});
	});

	it('uploads with the B2 headers', async () => {
		const { fetchFn, calls } = fakeB2();
		const url = await createB2(config, fetchFn).upload('Books/My Book.jpeg', BYTES);
		expect(calls[2]).toMatchObject({
			method: 'POST',
			url: 'https://up.example/u1',
			headers: {
				authorization: 'up-token',
				'x-bz-file-name': 'Books/My%20Book.jpeg',
				'content-type': 'image/jpeg',
				'x-bz-content-sha1': createHash('sha1').update(BYTES).digest('hex'),
				'x-bz-info-author': 'bruinen'
			}
		});
		expect(calls[2].body).toEqual(BYTES);
		expect(url).toBe('https://dl.example/file/covers/Books/My%20Book.jpeg');
	});

	it('reports the public prefix', async () => {
		const { fetchFn } = fakeB2();
		expect(await createB2(config, fetchFn).publicPrefix()).toBe('https://dl.example/file/covers/');
	});

	it('caches authorization for 12 hours', async () => {
		const { fetchFn, calls } = fakeB2();
		let time = 1_000_000;
		const b2 = createB2(config, fetchFn, () => time);
		await b2.upload('a.jpeg', BYTES);
		await b2.upload('b.jpeg', BYTES);
		const auths = () => calls.filter((c) => c.url.includes('b2_authorize_account')).length;
		expect(auths()).toBe(1);
		time += 12 * 3600 * 1000 + 1;
		await b2.upload('c.jpeg', BYTES);
		expect(auths()).toBe(2);
	});

	it('re-authorizes once when B2 answers 401', async () => {
		const { fetchFn, calls } = fakeB2({ uploadUrl: [expired] });
		const url = await createB2(config, fetchFn).upload('a.jpeg', BYTES);
		expect(url).toBe('https://dl.example/file/covers/a.jpeg');
		expect(calls.filter((c) => c.url.includes('b2_authorize_account'))).toHaveLength(2);

		const twice = fakeB2({ upload: [expired, expired] });
		await expect(createB2(config, twice.fetchFn).upload('a.jpeg', BYTES)).rejects.toBeInstanceOf(
			B2Error
		);
	});

	it('rejects with B2Error on a network error or non-2xx', async () => {
		const down = fakeB2({ auth: [new TypeError('fetch failed')] });
		await expect(createB2(config, down.fetchFn).upload('a.jpeg', BYTES)).rejects.toBeInstanceOf(
			B2Error
		);
		const refused = fakeB2({ upload: [{ status: 400, body: { code: 'bad_request' } }] });
		await expect(createB2(config, refused.fetchFn).upload('a.jpeg', BYTES)).rejects.toBeInstanceOf(
			B2Error
		);
		const badKey = fakeB2({ auth: [{ status: 401, body: { code: 'unauthorized' } }] });
		await expect(createB2(config, badKey.fetchFn).publicPrefix()).rejects.toBeInstanceOf(B2Error);
	});
});
