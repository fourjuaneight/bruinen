import { describe, expect, it } from 'vitest';
import { JFIF, exif, jpeg, seg } from '../../../tests/fixtures/jpeg.ts';
import { InvalidJpegError, isJpeg, stripMetadata } from './jpeg.ts';

const DQT = Uint8Array.of(0x00, 1, 2, 3, 4);
const XMP = 'http://ns.adobe.com/xap/1.0/\0<x/>';
/** The minimal EXIF stripMetadata writes back for a rotated photo. */
const MINIMAL = (n: number) =>
	Uint8Array.of(
		...[0x45, 0x78, 0x69, 0x66, 0x00, 0x00],
		...[0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08],
		...[0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, n, 0x00, 0x00],
		...[0x00, 0x00, 0x00, 0x00]
	);

const markers = (file: Uint8Array) => {
	const found: number[] = [];
	for (let i = 2; i < file.length - 1;) {
		const m = file[i + 1];
		found.push(m);
		if (m === 0xda) break;
		i += 2 + ((file[i + 2] << 8) | file[i + 3]);
	}
	return found;
};

describe('isJpeg', () => {
	it('checks the first three bytes', () => {
		expect(isJpeg(jpeg([]))).toBe(true);
		expect(isJpeg(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(false);
		expect(isJpeg(Uint8Array.of(0xff, 0xd8))).toBe(false);
		expect(isJpeg(new Uint8Array())).toBe(false);
	});
});

describe('stripMetadata', () => {
	it('drops EXIF with GPS, XMP, IPTC and comments', () => {
		const input = jpeg([
			seg(0xe0, JFIF),
			seg(0xe1, exif({ gps: true })),
			seg(0xe1, XMP),
			seg(0xed, 'Photoshop 3.0\0IPTC'),
			seg(0xfe, 'hello'),
			seg(0xdb, DQT)
		]);
		expect(stripMetadata(input)).toEqual(jpeg([seg(0xe0, JFIF), seg(0xdb, DQT)]));
	});

	it('keeps JFIF, ICC_PROFILE and Adobe segments in order', () => {
		const icc = seg(0xe2, 'ICC_PROFILE\0\x01\x01data');
		const adobe = seg(0xee, 'Adobe\0\x64\0\0\0\0\x01');
		const input = jpeg([seg(0xe0, JFIF), icc, seg(0xe2, 'MPF\0stuff'), seg(0xdb, DQT), adobe]);
		expect(stripMetadata(input)).toEqual(jpeg([seg(0xe0, JFIF), icc, seg(0xdb, DQT), adobe]));
	});

	it('copies the scan data and everything after SOS unchanged', () => {
		const scan = Uint8Array.of(9, 8, 0xff, 0x00, 0xff, 0xd0, 7);
		const input = jpeg([seg(0xe0, JFIF), seg(0xfe, 'x')], scan);
		const out = stripMetadata(input);
		const sos = (file: Uint8Array) =>
			file.slice(file.findIndex((b, i) => b === 0xff && file[i + 1] === 0xda));
		expect(sos(out)).toEqual(sos(input));
	});

	it('keeps Orientation 6 as a minimal EXIF', () => {
		const input = jpeg([seg(0xe0, JFIF), seg(0xe1, exif({ orientation: 6, gps: true }))]);
		expect(stripMetadata(input)).toEqual(jpeg([seg(0xe0, JFIF), seg(0xe1, MINIMAL(6))]));
	});

	it('puts the minimal EXIF right after SOI when there is no JFIF', () => {
		const input = jpeg([seg(0xdb, DQT), seg(0xe1, exif({ orientation: 6 }))]);
		expect(stripMetadata(input)).toEqual(jpeg([seg(0xe1, MINIMAL(6)), seg(0xdb, DQT)]));
	});

	it('reads little-endian Orientation', () => {
		const input = jpeg([seg(0xe1, exif({ orientation: 8, littleEndian: true }))]);
		expect(stripMetadata(input)).toEqual(jpeg([seg(0xe1, MINIMAL(8))]));
	});

	it('writes no APP1 for Orientation 1 or none', () => {
		for (const opts of [{ orientation: 1, gps: true }, { gps: true }]) {
			const out = stripMetadata(jpeg([seg(0xe0, JFIF), seg(0xe1, exif(opts))]));
			expect(markers(out)).not.toContain(0xe1);
		}
	});

	it('drops every APP1, keeping the Orientation from the Exif one', () => {
		const input = jpeg([seg(0xe1, XMP), seg(0xe1, exif({ orientation: 3 }))]);
		const out = stripMetadata(input);
		expect(markers(out).filter((m) => m === 0xe1)).toHaveLength(1);
		expect(out).toEqual(jpeg([seg(0xe1, MINIMAL(3))]));
	});

	it('treats a malformed EXIF as having no orientation', () => {
		const out = stripMetadata(jpeg([seg(0xe1, 'Exif\0\0MM\0*\0\0\xff\xff')]));
		expect(out).toEqual(jpeg([]));
	});

	it('skips fill bytes before a marker', () => {
		const comment = seg(0xfe, 'hi');
		const input = jpeg([seg(0xe0, JFIF), Uint8Array.of(0xff, 0xff), comment, seg(0xdb, DQT)]);
		expect(stripMetadata(input)).toEqual(jpeg([seg(0xe0, JFIF), seg(0xdb, DQT)]));
	});

	it('drops anything appended after the image ends', () => {
		// Phones append MPF gain maps, previews (with their own EXIF) or motion-photo videos.
		const trailer = Uint8Array.of(
			...jpeg([seg(0xe1, exif({ orientation: 6, gps: true }))]),
			...new TextEncoder().encode('ftypmp42 \xa9xyz+40.0-074.0/')
		);
		const image = jpeg([seg(0xe0, JFIF), seg(0xdb, DQT)]);
		expect(stripMetadata(Uint8Array.of(...image, ...trailer))).toEqual(image);
	});

	it('drops metadata between progressive scans and keeps the scans', () => {
		const sos = Uint8Array.of(0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00);
		const scan1 = Uint8Array.of(5, 0xff, 0x00, 6, 0xff, 0xd0, 7);
		const scan2 = Uint8Array.of(8, 0xff, 0x00, 9);
		const dht = seg(0xc4, Uint8Array.of(0x10, 1, 2));
		const file = (between: Uint8Array[]) =>
			Uint8Array.of(
				0xff,
				0xd8,
				...seg(0xe0, JFIF),
				...sos,
				...scan1,
				...between.flatMap((b) => [...b]),
				...sos,
				...scan2,
				0xff,
				0xd9
			);
		const input = file([seg(0xe1, exif({ gps: true })), seg(0xfe, 'note'), dht]);
		expect(stripMetadata(input)).toEqual(file([dht]));
	});

	it('refuses truncated or SOS-less files', () => {
		const truncated = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x40, 1, 2);
		const noSos = Uint8Array.of(0xff, 0xd8, ...seg(0xe0, JFIF), 0xff, 0xd9);
		const notMarker = Uint8Array.of(0xff, 0xd8, 0x12, 0x34);
		for (const file of [truncated, noSos, notMarker]) {
			expect(() => stripMetadata(file)).toThrow(InvalidJpegError);
		}
	});
});
