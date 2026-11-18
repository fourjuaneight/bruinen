import { POCKETBASE_URL } from '$app/env/private';

/** Base URL of Rivendell's PocketBase; declared, defaulted and normalized in src/env.ts. */
export function pocketbaseUrl(): string {
	return POCKETBASE_URL;
}
