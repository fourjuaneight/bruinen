import { describe, expect, it } from 'vitest';
import { isbn10To13, isValidEan13, isValidUpcA, normalizeScan } from './barcode.ts';

describe('check digits', () => {
	it('validates EAN-13', () => {
		expect(isValidEan13('9780451524935')).toBe(true);
		expect(isValidEan13('9780451524936')).toBe(false);
		expect(isValidEan13('978045152493')).toBe(false);
	});

	it('validates UPC-A', () => {
		expect(isValidUpcA('036000291452')).toBe(true);
		expect(isValidUpcA('036000291453')).toBe(false);
	});
});

describe('isbn10To13', () => {
	it('converts a valid ISBN-10', () => {
		expect(isbn10To13('0451524934')).toBe('9780451524935');
		expect(isbn10To13('080442957X')).toBe('9780804429573');
	});

	it('rejects a bad ISBN-10 check digit', () => {
		expect(isbn10To13('0451524935')).toBeNull();
	});
});

describe('normalizeScan', () => {
	it.each([
		['9780451524935', 'isbn', '9780451524935'],
		['978-0-451-52493-5', 'isbn', '9780451524935'],
		['0451524934', 'isbn', '9780451524935'],
		['0828768199121', 'isbn', null],
		['036000291452', 'barcode', '036000291452'],
		['0828768199121', 'barcode', '0828768199121'],
		['96385074', 'barcode', '96385074'],
		['123', 'barcode', null],
		['9780451524936', 'barcode', null]
	] as const)('%s as %s → %s', (raw, target, expected) => {
		expect(normalizeScan(raw, target)).toBe(expected);
	});
});
