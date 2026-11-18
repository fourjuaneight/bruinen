import type { IncomingMessage, ServerResponse } from 'node:http';
import type { MockState } from './server.ts';

export type RouteHandler = (
	state: MockState,
	req: IncomingMessage,
	res: ServerResponse,
	url: URL,
	body: Record<string, unknown>
) => boolean | Promise<boolean>;

/** Record routes register here; server.ts tries them in order after auth and control routes. */
export const recordRoutes: RouteHandler[] = [];
