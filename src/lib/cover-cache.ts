/**
 * The service worker's cover cache (IMAGE_CACHE in src/service-worker/index.ts imports it from
 * here). Covers are cached cache-first by URL, so a cover replaced in place keeps its URL and
 * would keep showing the old image.
 */
export const IMAGE_CACHE = 'bruinen-images';

/**
 * Drop a replaced cover from this device's caches: the service worker's copy, then the
 * browser's HTTP cache (by fetching it again with `cache: 'reload'`). Other devices keep their
 * copy until it is evicted. Failures are ignored: the worst case is a stale image.
 */
export async function refreshCachedImage(url: string): Promise<void> {
	try {
		if (typeof caches !== 'undefined') await (await caches.open(IMAGE_CACHE)).delete(url);
	} catch {
		// No Cache API (or no access to it): nothing to clear.
	}
	try {
		await fetch(url, { mode: 'no-cors', cache: 'reload' });
	} catch {
		// Offline or blocked: the image reloads from the network later.
	}
}
