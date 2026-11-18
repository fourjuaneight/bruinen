export type MockRecord = Record<string, unknown> & { id: string; rowid: number };
export type Db = Record<string, MockRecord[]>;

export const MOCK_ORIGIN = 'http://127.0.0.1:8099';
export const COVER_OK = `${MOCK_ORIGIN}/covers/ok.png`;
export const COVER_MISSING = `${MOCK_ORIGIN}/covers/missing.png`;

let counter = 0;
const id = () => `rec${String(++counter).padStart(12, '0')}`;

function table(rows: Record<string, unknown>[]): MockRecord[] {
	return rows.map((row, i) => ({ id: id(), rowid: i + 1, ...row }));
}

/** Fresh fixture data. Relations hold meta IDs, exactly as Rivendell stores them. */
export function seed(): Db {
	counter = 0;
	const meta = table([
		...['rock', 'jazz', 'drama', 'sci-fi', 'fiction', 'action'].map((name) => ({
			name,
			type: 'genre'
		})),
		...['not_started', 'in_progress', 'completed'].map((name) => ({ name, type: 'status' })),
		...['1080p', '4k'].map((name) => ({ name, type: 'definition' })),
		...['pc', 'ps5'].map((name) => ({ name, type: 'platform' })),
		...['go', 'music', 'tech', 'programming'].map((name) => ({ name, type: 'tags' }))
	]);
	const m = (name: string) => meta.find((r) => r.name === name)?.id;

	const movies = table(
		Array.from({ length: 35 }, (_, i) => {
			const n = i + 1;
			return {
				title: n === 1 ? "O'Brien" : `Movie ${String(n).padStart(2, '0')}`,
				director: `Director ${n % 5}`,
				year: 1980 + n,
				genre: n % 2 ? m('drama') : m('sci-fi'),
				definition: m('4k'),
				status: m('not_started'),
				favorite: n % 7 === 0,
				barcode: '',
				comments: '',
				cover: n === 2 ? '' : n === 3 ? COVER_MISSING : COVER_OK
			};
		})
	);

	return {
		meta,
		movies,
		shows: table([
			{
				title: 'Severance',
				director: '',
				season: 1,
				genre: m('drama'),
				definition: m('1080p'),
				status: m('in_progress'),
				favorite: false,
				cover: COVER_OK
			}
		]),
		games: table([
			{
				title: 'Hollow Knight',
				publisher: 'Team Cherry',
				year: 2017,
				genre: m('action'),
				platform: m('pc'),
				status: m('completed'),
				favorite: true,
				cover: COVER_OK
			}
		]),
		books: table([
			{
				title: 'Nineteen Eighty-Four',
				author: 'George Orwell',
				isbn: '9780451524935',
				year: 1949,
				genre: m('fiction'),
				status: m('completed'),
				favorite: false,
				cover: COVER_OK
			},
			{
				title: 'Dune',
				author: 'Frank Herbert',
				isbn: '',
				year: 1965,
				genre: m('fiction'),
				status: m('not_started'),
				favorite: true,
				cover: ''
			},
			{
				title: 'Kindred',
				author: 'Octavia E. Butler',
				isbn: '',
				year: 1979,
				genre: m('fiction'),
				status: m('in_progress'),
				favorite: false,
				cover: COVER_OK
			}
		]),
		cds: table([
			{
				album: 'Lateralus',
				artist: 'Tool',
				barcode: '0828768199121',
				year: 2001,
				genre: m('rock'),
				cover: COVER_OK
			},
			{
				album: 'Blue Train',
				artist: 'John Coltrane',
				barcode: '',
				year: 1957,
				genre: m('jazz'),
				cover: COVER_OK
			}
		]),
		vinyls: table([
			{
				album: 'Kind of Blue',
				artist: 'Miles Davis',
				barcode: '',
				year: 1959,
				genre: m('jazz'),
				cover: COVER_OK
			}
		]),
		mtg: table([
			{
				name: 'Black Lotus',
				set: 'lea',
				set_name: 'Limited Edition Alpha',
				collector_number: 233,
				rarity: 'rare',
				colors: '',
				type: 'Artifact',
				artist: 'Christopher Rush',
				image: COVER_OK,
				back: ''
			},
			{
				name: 'Sheoldred, the Apocalypse',
				set: 'dmu',
				set_name: 'Dominaria United',
				collector_number: 107,
				rarity: 'mythic',
				colors: 'Black',
				type: 'Legendary Creature',
				artist: 'Chris Rahn',
				image: COVER_OK,
				back: ''
			}
		]),
		articles: table([
			{
				title: 'How Postgres Handles Transactions',
				creator: 'Jane Doe',
				url: 'https://example.com/pg',
				year: 2024,
				tags: [m('programming')],
				dead: false,
				shared: false,
				favorite: false,
				archive: 'https://b2.example/Articles/pg.md'
			}
		]),
		podcasts: table([
			{
				title: 'Episode 1',
				creator: 'Some Show',
				url: 'https://example.com/ep1.mp3',
				year: 2023,
				tags: [m('tech')],
				dead: false,
				shared: false,
				favorite: false,
				archive: ''
			}
		]),
		videos: table([
			{
				title: 'A Talk',
				creator: 'A Channel',
				url: 'https://www.youtube.com/watch?v=abc',
				year: 2022,
				tags: [m('go'), m('programming')],
				dead: false,
				shared: false,
				favorite: false,
				archive: ''
			}
		]),
		feeds: table([
			{
				title: 'Example Blog',
				url: 'https://example.com',
				rss: 'https://example.com/feed.xml',
				type: 'website',
				tags: [m('tech')],
				dead: false,
				shared: false
			}
		]),
		github: table([
			{
				url: 'https://github.com/pocketbase/pocketbase',
				name: 'pocketbase',
				owner: 'pocketbase',
				description: 'Backend in 1 file',
				language: 'Go'
			}
		]),
		read_later: table([
			{ title: 'Later Read', link: 'https://example.com/later', tags: [m('tech')] }
		]),
		watch_later: table([
			{
				title: 'Later Watch',
				channel: 'A Channel',
				link: 'https://www.youtube.com/watch?v=def',
				tags: [m('music')]
			}
		]),
		records: table([
			{
				company: 'Acme Corp',
				position: 'Engineer',
				stack: ['Go', 'Postgres'],
				start: '2022-01-01 00:00:00.000Z',
				end: ''
			}
		])
	};
}
