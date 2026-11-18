/** Something that finds barcodes in a video frame: native BarcodeDetector or the WASM ponyfill. */
export interface Detector {
	detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

interface NativeDetectorClass {
	new (options: { formats: string[] }): Detector;
	getSupportedFormats(): Promise<string[]>;
}

/**
 * Prefer the browser's own detector (Android Chrome, macOS Chrome). Otherwise load the zxing
 * WASM ponyfill on demand (iOS Safari), served from Bruinen itself rather than a CDN.
 */
export async function createDefaultDetector(): Promise<Detector> {
	const Native = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
	if (Native?.getSupportedFormats) {
		try {
			const supported = await Native.getSupportedFormats();
			if (supported.includes('ean_13')) {
				return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
			}
		} catch {
			// fall through to the ponyfill
		}
	}

	const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
		import('barcode-detector/ponyfill'),
		import('zxing-wasm/reader/zxing_reader.wasm?url')
	]);
	prepareZXingModule({
		overrides: {
			locateFile: (path: string, prefix: string) =>
				path.endsWith('.wasm') ? wasmUrl : prefix + path
		}
	});
	return new BarcodeDetector({ formats: FORMATS as never[] });
}
