import { describe, expect, it } from 'vitest';
import { COVER_MESSAGES, MAX_COVER_BYTES, coverFileError } from './covers.ts';

describe('coverFileError', () => {
	it('asks for a JPEG when there is no file, an empty one or another type', () => {
		expect(coverFileError(null)).toBe(COVER_MESSAGES.notJpeg);
		expect(coverFileError(undefined)).toBe(COVER_MESSAGES.notJpeg);
		expect(coverFileError({ type: 'image/jpeg', size: 0 })).toBe(COVER_MESSAGES.notJpeg);
		expect(coverFileError({ type: 'image/png', size: 100 })).toBe(COVER_MESSAGES.notJpeg);
	});

	it('allows a JPEG up to 10 MB', () => {
		expect(MAX_COVER_BYTES).toBe(10 * 1024 * 1024);
		expect(coverFileError({ type: 'image/jpeg', size: MAX_COVER_BYTES })).toBeNull();
		expect(coverFileError({ type: 'image/jpeg', size: MAX_COVER_BYTES + 1 })).toBe(
			'The image must be 10 MB or smaller.'
		);
	});

	it('uses the spec copy', () => {
		expect(COVER_MESSAGES).toEqual({
			notJpeg: 'Choose a JPEG image.',
			tooBig: 'The image must be 10 MB or smaller.',
			uploadFailed: "Couldn't upload the cover. Try again."
		});
	});
});
