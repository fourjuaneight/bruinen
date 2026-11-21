/**
 * Caches the app's own assets and the cover images it shows. Pages and their `__data.json`
 * are never cached: they hold signed-in data and must always come from the server.
 *
 * SvelteKit registers this worker on its own (kit.serviceWorker.register defaults to true).
 */
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self as sw } from '$app/service-worker';
// Covers keep their URL across deploys, so this cache does too. A cover replaced in place is
// cleared from it by the page that uploaded it (src/lib/cover-cache.ts).
import { IMAGE_CACHE } from '../lib/cover-cache.ts';

const STATIC_PREFIX = 'bruinen-static-';
/** Hashed build output plus `static/`, renamed every deploy so old caches can be dropped. */
const STATIC_CACHE = `${STATIC_PREFIX}${version}`;
/**
 * Oldest covers past this count are evicted. Covers load cross-origin from B2 as opaque
 * responses, which Chrome counts as several MB each against the origin's storage quota.
 */
const MAX_IMAGES = 500;

/** Manifest paths are relative to the base path, which is the worker's scope. */
const ASSETS = [...immutable, ...assets].map(
	({ path }) => new URL(path, sw.registration.scope).pathname
);
const ASSET_PATHS = new Set(ASSETS);

sw.addEventListener('install', (event) => {
	// Every asset must be cached before the worker installs, the same as a fresh page load.
	event.waitUntil(
		caches
			.open(STATIC_CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(clearOldCaches().then(() => sw.clients.claim()));
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin === sw.location.origin && ASSET_PATHS.has(url.pathname)) {
		event.respondWith(fromStaticCache(request, url.pathname));
		return;
	}
	if (request.destination === 'image') {
		event.respondWith(fromImageCache(event, request));
	}
	// Anything else (pages, __data.json, form posts) goes to the network untouched.
});

async function clearOldCaches() {
	const names = await caches.keys();
	await Promise.all(
		names
			.filter((name) => name.startsWith(STATIC_PREFIX) && name !== STATIC_CACHE)
			.map((name) => caches.delete(name))
	);
}

async function fromStaticCache(request: Request, path: string) {
	const cache = await caches.open(STATIC_CACHE);
	return (await cache.match(path)) ?? fetch(request);
}

async function fromImageCache(event: FetchEvent, request: Request) {
	const cache = await caches.open(IMAGE_CACHE);
	const cached = await cache.match(request);
	if (cached) return cached;

	const response = await fetch(request);
	// Opaque (cross-origin, no CORS) responses hide their status, so they're kept as-is.
	// A 206 can't be stored, and errors must not stick around in place of a later fix.
	if (response.status === 200 || response.type === 'opaque') {
		event.waitUntil(cache.put(request, response.clone()).then(() => trimCache(cache)));
	}
	return response;
}

/** Drop the oldest entries; cache.keys() lists them in insertion order. */
async function trimCache(cache: Cache) {
	const keys = await cache.keys();
	const excess = keys.length - MAX_IMAGES;
	if (excess > 0) await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}
