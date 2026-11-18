/**
 * Regenerates ean13.y4m: a one-frame video of the EAN-13 for ISBN 9780451524935, used by
 * Chromium's fake camera in scan.spec.ts. Needs ffmpeg on PATH.
 *   node tests/e2e/fixtures/make-barcode-video.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import bwipjs from 'bwip-js/node';

const png = await bwipjs.toBuffer({
	bcid: 'ean13',
	text: '9780451524935',
	scale: 4,
	height: 22,
	includetext: true,
	backgroundcolor: 'FFFFFF',
	paddingwidth: 24,
	paddingheight: 24
});

const dir = mkdtempSync(join(tmpdir(), 'bruinen-barcode-'));
const pngPath = join(dir, 'code.png');
writeFileSync(pngPath, png);

const out = join(import.meta.dirname, 'ean13.y4m');
execFileSync('ffmpeg', [
	'-y',
	'-loglevel',
	'error',
	'-i',
	pngPath,
	'-vf',
	'scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2:white',
	'-frames:v',
	'1',
	'-pix_fmt',
	'yuv420p',
	out
]);
console.log(`wrote ${out}`);
