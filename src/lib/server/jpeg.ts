/**
 * JPEG checks and metadata stripping. Covers live in a public bucket and phone photos carry EXIF
 * (GPS included), so metadata is removed before upload. Only marker segments before the image
 * data are touched; the scan data is copied byte for byte, so the picture is not re-encoded.
 */

export class InvalidJpegError extends Error {
	constructor(message = 'Not a readable JPEG') {
		super(message);
		this.name = 'InvalidJpegError';
	}
}

/** True when the bytes start like a JPEG: SOI followed by a marker (FF D8 FF). */
export function isJpeg(bytes: Uint8Array): boolean {
	return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

const SOS = 0xda;
const COM = 0xfe;

const startsWith = (payload: Uint8Array, prefix: string) =>
	payload.length >= prefix.length && [...prefix].every((c, i) => payload[i] === c.charCodeAt(0));

/** Which segments survive: everything but APPn and comments, plus the APPn decoders need. */
function keep(marker: number, payload: Uint8Array): boolean {
	if (marker === COM) return false;
	if (marker < 0xe0 || marker > 0xef) return true;
	if (marker === 0xe0) return startsWith(payload, 'JFIF\0') || startsWith(payload, 'JFXX\0');
	if (marker === 0xe2) return startsWith(payload, 'ICC_PROFILE\0');
	if (marker === 0xee) return startsWith(payload, 'Adobe');
	return false;
}

/** EXIF Orientation from IFD0, or undefined when absent or the TIFF data is malformed. */
function orientationOf(payload: Uint8Array): number | undefined {
	const tiff = payload.subarray(6);
	if (tiff.length < 8) return undefined;
	const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
	const order = view.getUint16(0);
	if (order !== 0x4949 && order !== 0x4d4d) return undefined;
	const le = order === 0x4949;
	const ifd = view.getUint32(4, le);
	if (ifd + 2 > tiff.length) return undefined;
	const count = view.getUint16(ifd, le);
	for (let i = 0; i < count; i++) {
		const at = ifd + 2 + i * 12;
		if (at + 12 > tiff.length) return undefined;
		if (view.getUint16(at, le) === 0x0112 && view.getUint16(at + 2, le) === 3) {
			return view.getUint16(at + 8, le);
		}
	}
	return undefined;
}

/** An APP1 holding only Orientation, big-endian, so a sideways phone photo still shows upright. */
function minimalExif(orientation: number): Uint8Array {
	const payload = Uint8Array.of(
		...[0x45, 0x78, 0x69, 0x66, 0x00, 0x00],
		...[0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08],
		...[0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01],
		...[orientation >> 8, orientation & 0xff, 0x00, 0x00],
		...[0x00, 0x00, 0x00, 0x00]
	);
	const len = payload.length + 2;
	return Uint8Array.of(0xff, 0xe1, len >> 8, len & 0xff, ...payload);
}

/**
 * Remove EXIF, XMP, IPTC, comments and other APPn metadata, keeping JFIF, the ICC profile, the
 * Adobe segment, every table and frame header, and the scan data unchanged. An EXIF Orientation
 * other than 1 is written back as a minimal EXIF. Throws InvalidJpegError for anything that
 * can't be walked to its start of scan.
 */
export function stripMetadata(bytes: Uint8Array): Uint8Array {
	if (!isJpeg(bytes)) throw new InvalidJpegError();
	const leading: Uint8Array[] = [];
	const rest: Uint8Array[] = [];
	let orientation: number | undefined;
	let i = 2;

	for (;;) {
		if (i >= bytes.length || bytes[i] !== 0xff) throw new InvalidJpegError();
		while (i + 1 < bytes.length && bytes[i + 1] === 0xff) i++; // fill bytes
		if (i + 1 >= bytes.length) throw new InvalidJpegError();
		const marker = bytes[i + 1];

		if (marker === SOS) {
			rest.push(bytes.subarray(i));
			break;
		}
		if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
			rest.push(bytes.subarray(i, i + 2));
			i += 2;
			continue;
		}
		if (i + 4 > bytes.length) throw new InvalidJpegError();
		const len = (bytes[i + 2] << 8) | bytes[i + 3];
		const end = i + 2 + len;
		if (len < 2 || end > bytes.length) throw new InvalidJpegError();
		const payload = bytes.subarray(i + 4, end);

		if (marker === 0xe1 && startsWith(payload, 'Exif\0\0')) {
			orientation = orientationOf(payload) ?? orientation;
		}
		if (keep(marker, payload)) {
			const segment = bytes.subarray(i, end);
			// JFIF must stay first; the minimal EXIF goes right after any leading APP0.
			if (marker === 0xe0 && rest.length === 0) leading.push(segment);
			else rest.push(segment);
		}
		i = end;
	}

	const exif = orientation !== undefined && orientation !== 1 ? [minimalExif(orientation)] : [];
	const parts = [Uint8Array.of(0xff, 0xd8), ...leading, ...exif, ...rest];
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let at = 0;
	for (const part of parts) {
		out.set(part, at);
		at += part.length;
	}
	return out;
}
