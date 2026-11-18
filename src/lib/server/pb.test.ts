import { ClientResponseError } from 'pocketbase';
import { describe, expect, it } from 'vitest';
import { createPb, toHttpError } from './pb.ts';

const pbError = (status: number) =>
	new ClientResponseError({ url: 'http://x', status, response: { message: 'boom', data: {} } });

describe('toHttpError', () => {
	it.each([
		[0, 503, 'Rivendell is unreachable'],
		[404, 404, 'Not found'],
		[401, 401, 'Session expired'],
		[403, 401, 'Session expired'],
		[500, 502, 'Rivendell error'],
		[400, 502, 'Rivendell error']
	])('PocketBase status %i → %i', (status, expected, message) => {
		expect(toHttpError(pbError(status))).toEqual({ status: expected, message });
	});

	it('hides unexpected non-PocketBase errors', () => {
		expect(toHttpError(new Error('secret detail'))).toEqual({
			status: 500,
			message: 'Unexpected error'
		});
	});

	it('passes SvelteKit HttpErrors through', () => {
		expect(toHttpError({ status: 404, body: { message: 'Not found' } })).toEqual({
			status: 404,
			message: 'Not found'
		});
	});
});

describe('createPb', () => {
	it('points at POCKETBASE_URL', () => {
		process.env.POCKETBASE_URL = 'http://rivendell-app:8090/';
		expect(createPb().baseURL).toBe('http://rivendell-app:8090');
	});
});

describe('longFetch', () => {
	it('performs a real request through the long-timeout dispatcher', async () => {
		const { createServer } = await import('node:http');
		const { longFetch } = await import('./pb.ts');
		const server = createServer((_req, res) => res.end('ok'));
		await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
		const { port } = server.address() as { port: number };
		try {
			const res = await longFetch(`http://127.0.0.1:${port}/`);
			expect(await res.text()).toBe('ok');
		} finally {
			server.close();
		}
	});
});
