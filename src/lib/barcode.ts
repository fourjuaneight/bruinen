/**
 * Barcode checks for what the camera reads. ISBN fields want a 13-digit ISBN (Bookland EAN,
 * 978/979); barcode fields keep the code as printed (EAN-13, UPC-A or EAN-8), which is what
 * Discogs matches against.
 */

const digits = (s: string) => [...s].map(Number);

/** Mod-10 check used by EAN/UPC: weights alternate starting with `first` from the left. */
function gtinCheckOk(code: string, length: number, first: 1 | 3): boolean {
	if (!new RegExp(`^\\d{${length}}$`).test(code)) return false;
	const d = digits(code);
	const sum = d
		.slice(0, -1)
		.reduce((acc, n, i) => acc + n * (i % 2 === 0 ? first : first === 1 ? 3 : 1), 0);
	return (10 - (sum % 10)) % 10 === d[d.length - 1];
}

export const isValidEan13 = (code: string) => gtinCheckOk(code, 13, 1);
export const isValidUpcA = (code: string) => gtinCheckOk(code, 12, 3);
const isValidEan8 = (code: string) => gtinCheckOk(code, 8, 3);

function isValidIsbn10(isbn: string): boolean {
	if (!/^\d{9}[\dX]$/.test(isbn)) return false;
	const sum = [...isbn].reduce((acc, ch, i) => acc + (ch === 'X' ? 10 : Number(ch)) * (10 - i), 0);
	return sum % 11 === 0;
}

export function isbn10To13(isbn10: string): string | null {
	const isbn = isbn10.toUpperCase();
	if (!isValidIsbn10(isbn)) return null;
	const body = `978${isbn.slice(0, 9)}`;
	const sum = digits(body).reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 1 : 3), 0);
	return body + ((10 - (sum % 10)) % 10);
}

/** A cleaned, valid code for the target field, or null when the scan isn't usable there. */
export function normalizeScan(raw: string, target: 'isbn' | 'barcode'): string | null {
	const code = raw.replace(/[\s-]/g, '').toUpperCase();
	if (target === 'isbn') {
		if (isValidEan13(code) && /^97[89]/.test(code)) return code;
		return code.length === 10 ? isbn10To13(code) : null;
	}
	if (isValidEan13(code) || isValidUpcA(code) || isValidEan8(code)) return code;
	return null;
}
