import { defineEnvVars } from '@sveltejs/kit/env';

/**
 * Environment variables, read by SvelteKit from `.env` in dev and from the process environment
 * in production (so `.env` works with `pnpm dev`, unlike reading process.env directly).
 */
export const variables = defineEnvVars({
	POCKETBASE_URL: {
		description: "Rivendell's PocketBase as seen from the Bruinen server, not the browser",
		schema: (value) => (value || 'http://127.0.0.1:8090').replace(/\/+$/, '')
	}
});
