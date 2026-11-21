import { createHash } from 'node:crypto';
import { b2Config } from './config.ts';
import { publicUrl } from './cover-path.ts';

export interface B2Config {
	keyId: string;
	key: string;
	bucketId: string;
	bucketName: string;
	/** API base, `https://api.backblazeb2.com` outside tests. */
	apiUrl: string;
}

/** Any failed B2 call: network, auth or a B2 error response. */
export class B2Error extends Error {
	constructor(
		message: string,
		readonly status = 0
	) {
		super(message);
		this.name = 'B2Error';
	}
}

export interface B2Client {
	/** `{downloadUrl}/file/{bucketName}/`: what every public cover URL in the bucket starts with. */
	publicPrefix(): Promise<string>;
	/** Upload a JPEG under `path` (a B2 file name like `Books/Dune.jpeg`); returns its public URL. */
	upload(path: string, bytes: Uint8Array): Promise<string>;
}

interface Auth {
	apiUrl: string;
	authorizationToken: string;
	downloadUrl: string;
}

/** Trusted for 12 hours, like Rivendell, well inside B2's 24-hour token lifetime. */
const AUTH_TTL = 12 * 3600 * 1000;

/**
 * A B2 native-API client mirroring Rivendell's helpers/uploadToB2.go: authorize (cached),
 * get an upload URL, upload with a SHA-1. A 401 from either upload call drops the cached
 * authorization and retries once with a fresh one.
 */
export function createB2(
	config: B2Config,
	fetchFn: typeof fetch = fetch,
	now: () => number = Date.now
): B2Client {
	let cached: { auth: Auth; expires: number } | undefined;

	async function call(url: string, init: RequestInit): Promise<Record<string, unknown>> {
		let res: Response;
		try {
			res = await fetchFn(url, init);
		} catch (err) {
			throw new B2Error(`B2 request failed: ${String(err)}`);
		}
		const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
		if (!res.ok) throw new B2Error(`B2 ${res.status}: ${String(body.code ?? '')}`, res.status);
		return body;
	}

	async function authorize(): Promise<Auth> {
		if (cached && now() < cached.expires) return cached.auth;
		const basic = Buffer.from(`${config.keyId}:${config.key}`).toString('base64');
		const body = await call(`${config.apiUrl}/b2api/v2/b2_authorize_account`, {
			headers: { Authorization: `Basic ${basic}` }
		});
		const auth = {
			apiUrl: String(body.apiUrl),
			authorizationToken: String(body.authorizationToken),
			downloadUrl: String(body.downloadUrl)
		};
		cached = { auth, expires: now() + AUTH_TTL };
		return auth;
	}

	async function attempt(path: string, bytes: Uint8Array): Promise<string> {
		const auth = await authorize();
		const target = await call(`${auth.apiUrl}/b2api/v1/b2_get_upload_url`, {
			method: 'POST',
			headers: { Authorization: auth.authorizationToken },
			body: JSON.stringify({ bucketId: config.bucketId })
		});
		await call(String(target.uploadUrl), {
			method: 'POST',
			headers: {
				Authorization: String(target.authorizationToken),
				'X-Bz-File-Name': path.split('/').map(encodeURIComponent).join('/'),
				'Content-Type': 'image/jpeg',
				'X-Bz-Content-Sha1': createHash('sha1').update(bytes).digest('hex'),
				'X-Bz-Info-Author': 'bruinen'
			},
			body: bytes as Uint8Array<ArrayBuffer>
		});
		return publicUrl(prefixOf(auth), path);
	}

	const prefixOf = (auth: Auth) => `${auth.downloadUrl}/file/${config.bucketName}/`;

	return {
		async publicPrefix() {
			return prefixOf(await authorize());
		},
		async upload(path, bytes) {
			try {
				return await attempt(path, bytes);
			} catch (err) {
				if (!(err instanceof B2Error) || err.status !== 401) throw err;
				cached = undefined;
				return attempt(path, bytes);
			}
		}
	};
}

let client: B2Client | null | undefined;

/** The B2 client for this server, or null when B2 isn't configured (cover upload is off). */
export function b2(): B2Client | null {
	if (client === undefined) {
		const config = b2Config();
		client = config ? createB2(config) : null;
	}
	return client;
}
