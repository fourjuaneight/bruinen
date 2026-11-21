import type { CollectionDef } from '../collections.ts';

type Item = Record<string, unknown>;

/** Rivendell's emojiRange (rivendell/utils/emojiUnicode.go). */
const EMOJI =
	/[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}\u{200d}]/gu;
const DASH_RUN = /[-|\\]+/g;
const NON_FILE_NAME = /[^a-zA-Z0-9_\- ]+/g;
const MARKS = /\p{Mn}/gu;

const SEPARATORS: [string, string][] = [
	['‘', `'`],
	['’', `'`],
	['“', `"`],
	['”', `"`],
	['. ', '-'],
	[', ', '-'],
	[' :: ', '-'],
	[' : ', '-'],
	[': ', '-'],
	[' - ', '-'],
	[' -- ', '-'],
	[' – ', '-'],
	[' –– ', '-'],
	[' — ', '-'],
	[' —— ', '-'],
	['… ', '_']
];

const trimSuffix = (s: string, suffix: string) => (s.endsWith(suffix) ? s.slice(0, -1) : s);

/**
 * A port of Rivendell's utils.FileNameFmt (rivendell/utils/fileNameFmt.go), step for step, so
 * Bruinen names cover files the way Rivendell's enrichers do.
 */
export function fileNameFmt(name: string): string {
	let s = name.replace(EMOJI, '').replace(/^[ \t\n\r\v\f]+|[ \t\n\r\v\f]+$/g, '');
	s = trimSuffix(trimSuffix(trimSuffix(s, '.'), '?'), '!');
	for (const [from, to] of SEPARATORS) s = s.replaceAll(from, to);
	s = s.replace(DASH_RUN, '-');
	s = s.replaceAll(' & ', '_and_').replaceAll('&', '_and_').replaceAll('?', '');
	s = s.replace(NON_FILE_NAME, '').replaceAll(' ', '_');
	return s.replace(MARKS, '');
}

/** B2 folder per collection (rivendell/helpers/uploadToB2.go pathMap). */
export const COVER_FOLDERS: Readonly<Record<string, string>> = {
	books: 'Books',
	cds: 'CDs',
	games: 'Games',
	movies: 'Movies',
	shows: 'Shows',
	vinyls: 'Vinyls'
};

const positive = (value: unknown) => (typeof value === 'number' && value > 0 ? value : 0);

/**
 * The cover file name without folder or extension, following Rivendell's enrichers: shows add
 * -sNN for a season, movies add -{year} (left off when the record has no year). An empty name
 * falls back to the record ID.
 */
export function coverName(def: CollectionDef, record: Item): string {
	const name = fileNameFmt(String(record[def.titleField] ?? '')) || String(record.id);
	const season = positive(record.season);
	const year = positive(record.year);
	if (def.name === 'shows' && season) return `${name}-s${String(season).padStart(2, '0')}`;
	if (def.name === 'movies' && year) return `${name}-${year}`;
	return name;
}

/**
 * The B2 file name a new cover goes to. A cover already in the bucket, in this collection's
 * folder, keeps its exact path, so the upload replaces that file; otherwise the name is built
 * the way Rivendell builds it.
 */
export function coverPath(def: CollectionDef, record: Item, publicPrefix: string): string {
	const folder = COVER_FOLDERS[def.name];
	const current = typeof record.cover === 'string' ? record.cover : '';
	// Only reuse a file in this collection's own folder, so a link pointing at another
	// collection's cover never gets that file overwritten.
	if (current.startsWith(`${publicPrefix}${folder}/`)) {
		return current.slice(publicPrefix.length).split('/').map(decodeURIComponent).join('/');
	}
	return `${folder}/${coverName(def, record)}.jpeg`;
}

/** A file only this record uses, for when its cover file is shared with another record. */
export function ownCoverPath(def: CollectionDef, record: Item): string {
	return `${COVER_FOLDERS[def.name]}/${coverName(def, record)}-${String(record.id)}.jpeg`;
}

/** The public link for a B2 file name: `{downloadUrl}/file/{bucket}/` plus the encoded path. */
export function publicUrl(publicPrefix: string, path: string): string {
	return publicPrefix + path.split('/').map(encodeURIComponent).join('/');
}
