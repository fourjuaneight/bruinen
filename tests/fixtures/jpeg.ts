/**
 * Byte builders for JPEG tests. They make files that are structurally valid (markers, segment
 * lengths, EXIF/TIFF layout) without being decodable images, which is all the metadata
 * stripper looks at.
 */

const bytes = (value: Uint8Array | string) =>
	typeof value === 'string' ? Uint8Array.from(value, (c) => c.charCodeAt(0)) : value;

const concat = (parts: Uint8Array[]) => {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let at = 0;
	for (const part of parts) {
		out.set(part, at);
		at += part.length;
	}
	return out;
};

/** One marker segment: FF, the marker, a big-endian length (payload + 2), then the payload. */
export function seg(marker: number, payload: Uint8Array | string): Uint8Array {
	const body = bytes(payload);
	const len = body.length + 2;
	return concat([Uint8Array.of(0xff, marker, len >> 8, len & 0xff), body]);
}

export const JFIF = 'JFIF\0\x01\x01\0\0\x01\0\x01\0\0';
/** A minimal SOS segment: one component, full spectral range. */
const SOS = Uint8Array.of(0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00);

/** SOI, the segments, SOS, the scan bytes, EOI. */
export function jpeg(
	segments: Uint8Array[],
	scan = Uint8Array.of(1, 2, 3, 0xff, 0x00, 4)
): Uint8Array {
	return concat([Uint8Array.of(0xff, 0xd8), ...segments, SOS, scan, Uint8Array.of(0xff, 0xd9)]);
}

/**
 * An APP1 EXIF payload: `Exif\0\0`, a TIFF header and IFD0. IFD0 holds Orientation when given,
 * and with `gps` a pointer to a GPS IFD holding GPSLatitudeRef 'N'.
 */
export function exif(opts: {
	orientation?: number;
	gps?: boolean;
	littleEndian?: boolean;
}): Uint8Array {
	const le = Boolean(opts.littleEndian);
	const entries: [tag: number, type: number, value: number][] = [];
	if (opts.orientation !== undefined) entries.push([0x0112, 3, opts.orientation]);
	const ifd0Size = 2 + entries.length * 12 + (opts.gps ? 12 : 0) + 4;
	const gpsOffset = 8 + ifd0Size;
	if (opts.gps) entries.push([0x8825, 4, gpsOffset]);

	const tiff = new DataView(new ArrayBuffer(8 + ifd0Size + (opts.gps ? 2 + 12 + 4 : 0)));
	tiff.setUint16(0, le ? 0x4949 : 0x4d4d);
	tiff.setUint16(2, 42, le);
	tiff.setUint32(4, 8, le);
	tiff.setUint16(8, entries.length, le);
	entries.forEach(([tag, type, value], i) => {
		const at = 10 + i * 12;
		tiff.setUint16(at, tag, le);
		tiff.setUint16(at + 2, type, le);
		tiff.setUint32(at + 4, 1, le);
		if (type === 3) tiff.setUint16(at + 8, value, le);
		else tiff.setUint32(at + 8, value, le);
	});
	if (opts.gps) {
		tiff.setUint16(gpsOffset, 1, le);
		tiff.setUint16(gpsOffset + 2, 0x0001, le);
		tiff.setUint16(gpsOffset + 4, 2, le);
		tiff.setUint32(gpsOffset + 6, 2, le);
		tiff.setUint8(gpsOffset + 10, 'N'.charCodeAt(0));
	}
	return concat([bytes('Exif\0\0'), new Uint8Array(tiff.buffer)]);
}
