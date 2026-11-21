/** Cover upload rules shared by the browser check and the server (see server/cover.ts). */

export const MAX_COVER_BYTES = 10 * 1024 * 1024;

export const COVER_MESSAGES = {
	notJpeg: 'Choose a JPEG image.',
	tooBig: 'The image must be 10 MB or smaller.',
	uploadFailed: "Couldn't upload the cover. Try again."
} as const;

/**
 * The browser-side check before sending a file: its type label and size. The server never
 * trusts the label and checks the bytes instead.
 */
export function coverFileError(
	file: { type: string; size: number } | null | undefined
): string | null {
	if (!file || !file.size || file.type !== 'image/jpeg') return COVER_MESSAGES.notJpeg;
	if (file.size > MAX_COVER_BYTES) return COVER_MESSAGES.tooBig;
	return null;
}
