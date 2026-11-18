import bwipjs from 'bwip-js/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultDetector } from './detector.ts';

// Named *.svelte.test.ts so it runs in the browser project, where WASM and canvas exist.
describe('createDefaultDetector (WASM path, as on iOS Safari)', () => {
	const native = (globalThis as Record<string, unknown>).BarcodeDetector;
	afterEach(() => {
		(globalThis as Record<string, unknown>).BarcodeDetector = native;
	});

	it('decodes an EAN-13 with the self-hosted WASM and never calls a CDN', async () => {
		delete (globalThis as Record<string, unknown>).BarcodeDetector;
		const canvas = document.createElement('canvas');
		bwipjs.toCanvas(canvas, {
			bcid: 'ean13',
			text: '9780451524935',
			scale: 3,
			height: 20,
			backgroundcolor: 'FFFFFF',
			paddingwidth: 20,
			paddingheight: 20
		});

		const detector = await createDefaultDetector();
		const found = await detector.detect(canvas);

		expect(found.map((f) => f.rawValue)).toContain('9780451524935');
		const cdn = performance.getEntriesByType('resource').filter((e) => e.name.includes('jsdelivr'));
		expect(cdn).toEqual([]);
	});
});
