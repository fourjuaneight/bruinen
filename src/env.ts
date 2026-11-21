import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value ?? '';

/**
 * Environment variables, read by SvelteKit from `.env` in dev and from the process environment
 * in production (so `.env` works with `pnpm dev`, unlike reading process.env directly).
 */
export const variables = defineEnvVars({
	POCKETBASE_URL: {
		description: "Rivendell's PocketBase as seen from the Bruinen server, not the browser",
		schema: (value) => (value || 'http://127.0.0.1:8090').replace(/\/+$/, '')
	},
	B2_APP_KEY_ID: {
		description:
			"Bruinen's own B2 application key ID (cover upload is off until all four B2_ vars are set)",
		schema: optional
	},
	B2_APP_KEY: { description: "That B2 application key's secret", schema: optional },
	B2_BUCKET_ID: { description: "ID of the B2 bucket Rivendell's covers live in", schema: optional },
	B2_BUCKET_NAME: {
		description: 'Name of that bucket, for the public cover URLs',
		schema: optional
	},
	B2_API_URL: {
		description: 'B2 API base URL; only tests point it elsewhere',
		schema: (value) => (value || 'https://api.backblazeb2.com').replace(/\/+$/, '')
	}
});
