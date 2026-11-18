const DEFAULT_POCKETBASE_URL = 'http://127.0.0.1:8090';

/** Base URL of Rivendell's PocketBase, read at call time so tests and deploys can override it. */
export function pocketbaseUrl(): string {
	return (process.env.POCKETBASE_URL || DEFAULT_POCKETBASE_URL).replace(/\/+$/, '');
}
