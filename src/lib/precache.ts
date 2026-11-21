/**
 * Fill the service worker's new static cache with `paths`. A hashed build file (in `hashed`) that a
 * previous deploy's cache still holds is copied from there, since a hashed name means unchanged
 * content; everything else is downloaded. A deploy then fetches only what changed, instead of
 * every file again (the barcode scanner's ~1 MB zxing WASM included).
 */
export async function precache(
	cache: Cache,
	paths: readonly string[],
	hashed: ReadonlySet<string>,
	previous: readonly Cache[]
): Promise<void> {
	const download: string[] = [];
	await Promise.all(
		paths.map(async (path) => {
			const copy = hashed.has(path) ? await firstMatch(previous, path) : undefined;
			if (copy) await cache.put(path, copy);
			else download.push(path);
		})
	);
	// addAll fails as a whole, so a worker never installs with part of the app missing.
	await cache.addAll(download);
}

async function firstMatch(caches: readonly Cache[], path: string): Promise<Response | undefined> {
	for (const cache of caches) {
		const hit = await cache.match(path);
		if (hit) return hit;
	}
	return undefined;
}
