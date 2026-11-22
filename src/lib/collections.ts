/**
 * Single source of truth for how Bruinen shows and creates records in each Rivendell collection.
 * Field names mirror rivendell/schema/collections.go; create fields mirror the "Send" lists in
 * rivendell/docs/API.md. Meta relations are submitted as names on create, where Rivendell's
 * preparers resolve them; Rivendell has no update hook, so edits must send meta IDs instead.
 */

export type MetaType = 'definition' | 'genre' | 'platform' | 'status' | 'tags';

export type FieldType =
	'text' | 'textarea' | 'number' | 'url' | 'date' | 'bool' | 'select' | 'meta' | 'tags' | 'json';

export interface FieldDef {
	name: string;
	label: string;
	type: FieldType;
	required?: boolean;
	metaType?: MetaType;
	options?: readonly string[];
	scan?: 'isbn' | 'barcode';
}

export type NavGroup = 'physical' | 'digital' | 'vocabulary';

/** The navigation groups, in display order. */
export const NAV_GROUPS: readonly { id: NavGroup; label: string }[] = [
	{ id: 'physical', label: 'Physical' },
	{ id: 'digital', label: 'Digital' },
	{ id: 'vocabulary', label: 'Vocabulary' }
];

export interface CollectionDef {
	name: string;
	label: string;
	/** One item, lower case unless it's an initialism: "Add book", "Add CD". */
	singular: string;
	/** Navigation group; the registry lists collections in group order. */
	group: NavGroup;
	/** Display label for a record; mirrors recordLabel() in rivendell/enrichers.go. */
	titleField: string;
	/** Field the user sends that identifies the record; used to find it after an opaque 400. */
	keyField: string;
	image?: 'cover' | 'image';
	imageAspect?: '2 / 3' | '1 / 1' | '63 / 88';
	columns: readonly FieldDef[];
	searchFields: readonly string[];
	sortable: readonly string[];
	defaultSort: string;
	expand: readonly string[];
	create: readonly FieldDef[];
	/** The edit form: every create field, then the favorite/dead/shared flags the collection stores. */
	edit: readonly FieldDef[];
	slowCreate?: boolean;
	/** Rivendell fetches extra data after create (covers, archives, metadata); edits never re-run it. */
	enriched?: boolean;
	/** One extra detail on cards: a show's season or a game's platform. */
	cardExtra?: { field: string; style: 'season' | 'uppercase' };
}

const text = (name: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({
	name,
	label,
	type: 'text',
	...extra
});
const num = (name: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({
	name,
	label,
	type: 'number',
	...extra
});
const url = (name: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({
	name,
	label,
	type: 'url',
	...extra
});
const date = (name: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({
	name,
	label,
	type: 'date',
	...extra
});
const bool = (name: string, label: string): FieldDef => ({ name, label, type: 'bool' });
const meta = (name: MetaType, label: string): FieldDef => ({
	name,
	label,
	type: 'meta',
	metaType: name
});
const tags = (required = true): FieldDef => ({
	name: 'tags',
	label: 'Tags',
	type: 'tags',
	metaType: 'tags',
	required
});
const comments: FieldDef = { name: 'comments', label: 'Comments', type: 'textarea' };
const year = num('year', 'Year');
const ROWID = '-@rowid';

type Draft = Omit<CollectionDef, 'edit' | 'singular' | 'group'>;

function archivable(name: string, label: string, sendTitle: boolean): Draft {
	return {
		name,
		label,
		titleField: 'title',
		keyField: sendTitle ? 'title' : 'url',
		columns: [
			text('title', 'Title'),
			text('creator', 'Creator'),
			year,
			tags(),
			bool('favorite', 'Favorite'),
			bool('dead', 'Dead')
		],
		searchFields: ['title', 'creator', 'tags.name'],
		sortable: ['title', 'creator', 'year'],
		defaultSort: ROWID,
		expand: ['tags'],
		create: sendTitle
			? [
					text('title', 'Title', { required: true }),
					text('creator', 'Creator', { required: true }),
					url('url', 'URL', { required: true }),
					tags(),
					year,
					comments
				]
			: [url('url', 'YouTube URL', { required: true }), tags(), comments],
		slowCreate: true
	};
}

function music(name: string, label: string): Draft {
	return {
		name,
		label,
		titleField: 'album',
		keyField: 'album',
		image: 'cover',
		imageAspect: '1 / 1',
		columns: [text('album', 'Album'), text('artist', 'Artist'), year, meta('genre', 'Genre')],
		searchFields: ['album', 'artist', 'barcode', 'genre.name'],
		sortable: ['album', 'artist', 'year'],
		defaultSort: ROWID,
		expand: ['genre'],
		create: [
			text('album', 'Album', { required: true }),
			text('artist', 'Artist', { required: true }),
			text('barcode', 'Barcode', { scan: 'barcode' }),
			meta('genre', 'Genre'),
			year,
			comments
		]
	};
}

function screen(name: 'movies' | 'shows', label: string): Draft {
	const season = name === 'shows' ? [num('season', 'Season')] : [];
	return {
		name,
		label,
		titleField: 'title',
		keyField: 'title',
		image: 'cover',
		imageAspect: '2 / 3',
		columns: [
			text('title', 'Title'),
			text('director', 'Director'),
			year,
			...season,
			meta('genre', 'Genre'),
			meta('definition', 'Definition'),
			meta('status', 'Status'),
			bool('favorite', 'Favorite')
		],
		searchFields: ['title', 'director', 'barcode', 'genre.name'],
		sortable: ['title', 'director', 'year', ...season.map((f) => f.name)],
		defaultSort: ROWID,
		expand: ['genre', 'definition', 'status'],
		...(name === 'shows' ? { cardExtra: { field: 'season', style: 'season' as const } } : {}),
		create: [
			text('title', 'Title', { required: true }),
			text('director', 'Director'),
			...season,
			text('barcode', 'Barcode', { scan: 'barcode' }),
			meta('genre', 'Genre'),
			meta('definition', 'Definition'),
			meta('status', 'Status'),
			year,
			comments
		]
	};
}

const DRAFTS: readonly Draft[] = [
	screen('movies', 'Movies'),
	screen('shows', 'Shows'),
	{
		name: 'games',
		label: 'Games',
		titleField: 'title',
		keyField: 'title',
		image: 'cover',
		imageAspect: '2 / 3',
		columns: [
			text('title', 'Title'),
			text('publisher', 'Publisher'),
			year,
			meta('platform', 'Platform'),
			meta('genre', 'Genre'),
			meta('status', 'Status'),
			bool('favorite', 'Favorite')
		],
		searchFields: ['title', 'publisher', 'barcode', 'platform.name', 'genre.name'],
		sortable: ['title', 'publisher', 'year'],
		defaultSort: ROWID,
		expand: ['genre', 'platform', 'status'],
		cardExtra: { field: 'platform', style: 'uppercase' },
		create: [
			text('title', 'Title', { required: true }),
			text('publisher', 'Publisher'),
			text('barcode', 'Barcode', { scan: 'barcode' }),
			meta('genre', 'Genre'),
			meta('platform', 'Platform'),
			meta('status', 'Status'),
			year,
			comments
		]
	},
	{
		name: 'books',
		label: 'Books',
		titleField: 'title',
		keyField: 'title',
		image: 'cover',
		imageAspect: '2 / 3',
		columns: [
			text('title', 'Title'),
			text('author', 'Author'),
			year,
			meta('genre', 'Genre'),
			meta('status', 'Status'),
			bool('favorite', 'Favorite')
		],
		searchFields: ['title', 'author', 'isbn', 'genre.name'],
		sortable: ['title', 'author', 'year'],
		defaultSort: ROWID,
		expand: ['genre', 'status'],
		create: [
			text('title', 'Title', { required: true }),
			text('author', 'Author', { required: true }),
			text('isbn', 'ISBN', { scan: 'isbn' }),
			meta('genre', 'Genre'),
			meta('status', 'Status'),
			year,
			comments
		]
	},
	music('cds', 'CDs'),
	music('vinyls', 'Vinyls'),
	{
		name: 'mtg',
		label: 'MTG',
		titleField: 'name',
		keyField: 'name',
		image: 'image',
		imageAspect: '63 / 88',
		columns: [
			text('name', 'Name'),
			text('set_name', 'Set'),
			num('collector_number', 'Number'),
			text('rarity', 'Rarity'),
			text('colors', 'Colors'),
			text('type', 'Type')
		],
		searchFields: ['name', 'set', 'set_name', 'type', 'artist'],
		sortable: ['name', 'set', 'rarity', 'collector_number'],
		defaultSort: ROWID,
		expand: [],
		create: [
			text('name', 'Name', { required: true }),
			text('set', 'Set code', { required: true }),
			num('collector_number', 'Collector number', { required: true })
		]
	},
	archivable('articles', 'Articles', true),
	archivable('podcasts', 'Podcasts', true),
	archivable('videos', 'Videos', false),
	{
		name: 'feeds',
		label: 'Feeds',
		titleField: 'title',
		keyField: 'title',
		columns: [
			text('title', 'Title'),
			{ name: 'type', label: 'Type', type: 'select' },
			tags(),
			bool('dead', 'Dead')
		],
		searchFields: ['title', 'url', 'tags.name'],
		sortable: ['title', 'type'],
		defaultSort: ROWID,
		expand: ['tags'],
		create: [
			text('title', 'Title', { required: true }),
			url('url', 'URL', { required: true }),
			url('rss', 'RSS URL'),
			{
				name: 'type',
				label: 'Type',
				type: 'select',
				required: true,
				options: ['podcast', 'website', 'youtube']
			},
			tags(),
			comments
		]
	},
	{
		name: 'read_later',
		label: 'Read later',
		titleField: 'title',
		keyField: 'title',
		columns: [text('title', 'Title'), url('link', 'Link'), tags()],
		searchFields: ['title', 'tags.name'],
		sortable: ['title'],
		defaultSort: ROWID,
		expand: ['tags'],
		create: [
			text('title', 'Title', { required: true }),
			url('link', 'Link', { required: true }),
			tags()
		]
	},
	{
		name: 'watch_later',
		label: 'Watch later',
		titleField: 'link',
		keyField: 'link',
		columns: [text('title', 'Title'), text('channel', 'Channel'), tags()],
		searchFields: ['title', 'channel', 'tags.name'],
		sortable: ['title', 'channel'],
		defaultSort: ROWID,
		expand: ['tags'],
		create: [url('link', 'YouTube URL', { required: true }), tags()]
	},
	{
		name: 'github',
		label: 'GitHub',
		titleField: 'url',
		keyField: 'url',
		columns: [
			text('name', 'Name'),
			text('owner', 'Owner'),
			text('language', 'Language'),
			text('description', 'Description')
		],
		searchFields: ['name', 'owner', 'description', 'language', 'url'],
		sortable: ['name', 'owner', 'language'],
		defaultSort: ROWID,
		expand: [],
		create: [url('url', 'Repository URL', { required: true })]
	},
	{
		name: 'records',
		label: 'Work records',
		titleField: 'company',
		keyField: 'company',
		columns: [
			text('company', 'Company'),
			text('position', 'Position'),
			date('start', 'Start'),
			date('end', 'End'),
			{ name: 'stack', label: 'Stack', type: 'json' }
		],
		searchFields: ['company', 'position'],
		sortable: ['company', 'start', 'end'],
		defaultSort: '-start',
		expand: [],
		create: [
			text('company', 'Company', { required: true }),
			text('position', 'Position'),
			{ name: 'stack', label: 'Stack (comma separated)', type: 'json' },
			date('start', 'Start', { required: true }),
			date('end', 'End')
		]
	},
	{
		name: 'meta',
		label: 'Meta',
		titleField: 'name',
		keyField: 'name',
		columns: [text('name', 'Name'), { name: 'type', label: 'Type', type: 'select' }],
		searchFields: ['name'],
		sortable: ['name', 'type'],
		defaultSort: 'name',
		expand: [],
		create: [
			text('name', 'Name', { required: true }),
			{
				name: 'type',
				label: 'Type',
				type: 'select',
				required: true,
				options: ['definition', 'genre', 'platform', 'status', 'tags']
			}
		]
	}
];

/** Flags set to false by Rivendell on create, so the create form leaves them out. */
const FLAGS: Record<string, readonly FieldDef[]> = {
	articles: [bool('favorite', 'Favorite'), bool('dead', 'Dead'), bool('shared', 'Shared')],
	podcasts: [bool('favorite', 'Favorite'), bool('dead', 'Dead'), bool('shared', 'Shared')],
	videos: [bool('favorite', 'Favorite'), bool('dead', 'Dead'), bool('shared', 'Shared')],
	feeds: [bool('dead', 'Dead'), bool('shared', 'Shared')],
	books: [bool('favorite', 'Favorite')],
	games: [bool('favorite', 'Favorite')],
	movies: [bool('favorite', 'Favorite')],
	shows: [bool('favorite', 'Favorite')]
};

/** Mirrors the enrichers map in rivendell/main.go. */
const ENRICHED = new Set(
	['articles', 'podcasts', 'videos', 'github', 'mtg', 'books', 'cds'].concat([
		'games',
		'movies',
		'shows',
		'vinyls',
		'watch_later'
	])
);

const SINGULAR: Record<string, string> = {
	movies: 'movie',
	shows: 'show',
	games: 'game',
	books: 'book',
	cds: 'CD',
	vinyls: 'vinyl',
	mtg: 'card',
	articles: 'article',
	podcasts: 'podcast',
	videos: 'video',
	feeds: 'feed',
	read_later: 'link',
	watch_later: 'video',
	github: 'repo',
	records: 'work record',
	meta: 'entry'
};

const PHYSICAL = new Set(['movies', 'shows', 'games', 'books', 'cds', 'vinyls', 'mtg']);

const groupOf = (name: string): NavGroup =>
	PHYSICAL.has(name) ? 'physical' : name === 'meta' ? 'vocabulary' : 'digital';

export const COLLECTIONS: readonly CollectionDef[] = DRAFTS.map((def) => ({
	...def,
	singular: SINGULAR[def.name],
	group: groupOf(def.name),
	edit: [...def.create, ...(FLAGS[def.name] ?? [])],
	...(ENRICHED.has(def.name) ? { enriched: true } : {})
}));

const BY_NAME = new Map(COLLECTIONS.map((def) => [def.name, def]));

export function getCollection(name: string): CollectionDef | undefined {
	return BY_NAME.get(name);
}
