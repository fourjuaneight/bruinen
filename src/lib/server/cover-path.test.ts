import { describe, expect, it } from 'vitest';
import { getCollection, type CollectionDef } from '../collections.ts';
import { coverPath, fileNameFmt, ownCoverPath, publicUrl } from './cover-path.ts';

const def = (name: string) => getCollection(name) as CollectionDef;
const PREFIX = 'https://f005.backblazeb2.com/file/covers/';

describe('fileNameFmt', () => {
	// Rivendell's TestFileNameFmt table (rivendell/utils/utils_test.go), copied verbatim.
	it.each([
		['Hello World', 'Hello_World'],
		['Hello - World', 'Hello-World'],
		['Hello: World', 'Hello-World'],
		['A :: B', 'A-B'],
		['A — B', 'A-B'],
		['A & B', 'A_and_B'],
		['A&B', 'A_and_B'],
		['Hello.', 'Hello'],
		['Hello?', 'Hello'],
		['Hello!', 'Hello'],
		['Hello 🎉', 'Hello'],
		['🎉 Hello', 'Hello'],
		['Hello@World', 'HelloWorld'],
		['A  B', 'A__B'],
		['A… B', 'A_B'],
		['A|B', 'A-B'],
		['‘hello’', 'hello'],
		['Part 1. Part 2', 'Part_1-Part_2'],
		['Title, Subtitle', 'Title-Subtitle'],
		['Hello — World! 🎉', 'Hello-World'],
		['caf́e', 'cafe']
	])('%s → %s', (input, want) => {
		expect(fileNameFmt(input)).toBe(want);
	});

	it('strips a title with no Latin letters or digits to nothing', () => {
		expect(fileNameFmt('日本語')).toBe('');
	});
});

describe('coverPath', () => {
	it('builds Books/{title}.jpeg when the record has no cover', () => {
		expect(coverPath(def('books'), { id: 'b1', title: 'Dune', cover: '' }, PREFIX)).toBe(
			'Books/Dune.jpeg'
		);
	});

	it('uses album for cds and vinyls', () => {
		expect(coverPath(def('cds'), { id: 'c1', album: 'Kind of Blue' }, PREFIX)).toBe(
			'CDs/Kind_of_Blue.jpeg'
		);
		expect(coverPath(def('vinyls'), { id: 'v1', album: 'Kind of Blue' }, PREFIX)).toBe(
			'Vinyls/Kind_of_Blue.jpeg'
		);
	});

	it('names games by title', () => {
		expect(coverPath(def('games'), { id: 'g1', title: 'Hollow Knight' }, PREFIX)).toBe(
			'Games/Hollow_Knight.jpeg'
		);
	});

	it('adds -sNN to a show with a season', () => {
		const shows = def('shows');
		expect(coverPath(shows, { id: 's1', title: 'Severance', season: 1 }, PREFIX)).toBe(
			'Shows/Severance-s01.jpeg'
		);
		expect(coverPath(shows, { id: 's1', title: 'Severance', season: 0 }, PREFIX)).toBe(
			'Shows/Severance.jpeg'
		);
	});

	it('adds -{year} to a movie with a year', () => {
		const movies = def('movies');
		expect(coverPath(movies, { id: 'm1', title: 'Alien', year: 1979 }, PREFIX)).toBe(
			'Movies/Alien-1979.jpeg'
		);
		expect(coverPath(movies, { id: 'm1', title: 'Alien', year: 0 }, PREFIX)).toBe(
			'Movies/Alien.jpeg'
		);
		expect(coverPath(movies, { id: 'm1', title: 'Alien' }, PREFIX)).toBe('Movies/Alien.jpeg');
	});

	it('falls back to the record id for an empty name', () => {
		expect(coverPath(def('books'), { id: 'b9', title: '日本語' }, PREFIX)).toBe('Books/b9.jpeg');
	});

	it('reuses the path of a cover already in the bucket', () => {
		const record = { id: 'm1', title: 'Alien', year: 1979, cover: PREFIX + 'Movies/Alien-.jpeg' };
		expect(coverPath(def('movies'), record, PREFIX)).toBe('Movies/Alien-.jpeg');
	});

	it("builds a name when a bucket cover sits in another collection's folder", () => {
		// Reusing it would overwrite a movie poster with a book cover.
		const record = { id: 'b1', title: 'Dune', cover: PREFIX + 'Movies/Dune-2021.jpeg' };
		expect(coverPath(def('books'), record, PREFIX)).toBe('Books/Dune.jpeg');
	});

	it('builds a name when the cover is hosted elsewhere', () => {
		const record = { id: 'b1', title: 'Dune', cover: 'https://img.example/x.jpg' };
		expect(coverPath(def('books'), record, PREFIX)).toBe('Books/Dune.jpeg');
	});

	it('reuses an encoded bucket path and rebuilds the same URL', () => {
		const record = { id: 'b1', title: 'Dune', cover: PREFIX + 'Books/My%20Book.jpeg' };
		const path = coverPath(def('books'), record, PREFIX);
		expect(path).toBe('Books/My Book.jpeg');
		expect(publicUrl(PREFIX, path)).toBe(record.cover);
	});
});

describe('ownCoverPath', () => {
	it('adds the record id to the built name', () => {
		expect(ownCoverPath(def('books'), { id: 'b1', title: 'Dune' })).toBe('Books/Dune-b1.jpeg');
		expect(ownCoverPath(def('shows'), { id: 's1', title: 'Severance', season: 2 })).toBe(
			'Shows/Severance-s02-s1.jpeg'
		);
	});
});
