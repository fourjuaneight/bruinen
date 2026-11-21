import {
	B2_API_URL,
	B2_APP_KEY,
	B2_APP_KEY_ID,
	B2_BUCKET_ID,
	B2_BUCKET_NAME,
	POCKETBASE_URL
} from '$app/env/private';
import type { B2Config } from './b2.ts';

/** Base URL of Rivendell's PocketBase; declared, defaulted and normalized in src/env.ts. */
export function pocketbaseUrl(): string {
	return POCKETBASE_URL;
}

interface B2Env {
	B2_APP_KEY_ID: string;
	B2_APP_KEY: string;
	B2_BUCKET_ID: string;
	B2_BUCKET_NAME: string;
	B2_API_URL: string;
}

/** The B2 settings, or null unless all four credentials are set (cover upload is then off). */
export function toB2Config(env: B2Env): B2Config | null {
	const { B2_APP_KEY_ID: keyId, B2_APP_KEY: key, B2_BUCKET_ID: bucketId } = env;
	const bucketName = env.B2_BUCKET_NAME;
	if (!keyId || !key || !bucketId || !bucketName) return null;
	return { keyId, key, bucketId, bucketName, apiUrl: env.B2_API_URL };
}

export function b2Config(): B2Config | null {
	return toB2Config({ B2_APP_KEY_ID, B2_APP_KEY, B2_BUCKET_ID, B2_BUCKET_NAME, B2_API_URL });
}
