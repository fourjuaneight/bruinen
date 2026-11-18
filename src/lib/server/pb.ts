import PocketBase, { ClientResponseError } from 'pocketbase';
import { Agent } from 'undici';
import { pocketbaseUrl } from './config.ts';

export const AUTH_COOKIE = 'pb_auth';
export const CREATE_TIMEOUT_MS = 600_000;

/** A server-side client. Auto-cancellation is off: parallel requests to one collection are normal here. */
export function createPb(): PocketBase {
	const pb = new PocketBase(pocketbaseUrl());
	pb.autoCancellation(false);
	return pb;
}

// Node's fetch gives up on response headers after 300s; archiving a video can take longer.
const slowAgent = new Agent({ headersTimeout: CREATE_TIMEOUT_MS, bodyTimeout: CREATE_TIMEOUT_MS });

export function longFetch(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	return fetch(url, {
		...init,
		signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
		// @ts-expect-error undici's dispatcher option is not in the DOM RequestInit type
		dispatcher: slowAgent
	});
}

export interface HttpErrorShape {
	status: number;
	message: string;
}

function isKitHttpError(err: unknown): err is { status: number; body: { message: string } } {
	if (typeof err !== 'object' || err === null) return false;
	const e = err as { status?: unknown; body?: { message?: unknown } };
	return typeof e.status === 'number' && typeof e.body?.message === 'string';
}

/** Map anything thrown while rendering to a status and a message safe to show the user. */
export function toHttpError(err: unknown): HttpErrorShape {
	if (err instanceof ClientResponseError) {
		if (err.status === 0) return { status: 503, message: 'Rivendell is unreachable' };
		if (err.status === 404) return { status: 404, message: 'Not found' };
		if (err.status === 401 || err.status === 403)
			return { status: 401, message: 'Session expired' };
		return { status: 502, message: 'Rivendell error' };
	}
	if (isKitHttpError(err)) return { status: err.status, message: err.body.message };
	return { status: 500, message: 'Unexpected error' };
}
