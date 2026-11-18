export type MockRecord = Record<string, unknown> & { id: string; rowid: number };
export type Db = Record<string, MockRecord[]>;

/** Seed data is filled in by the browse task; auth only needs the collections to exist. */
export function seed(): Db {
	return {};
}
