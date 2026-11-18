import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getCollection, type CollectionDef } from '../collections.ts';
import Toolbar from './Toolbar.svelte';

const movies = getCollection('movies') as CollectionDef;
const query = (q: string) => ({ q, sort: '-@rowid', page: 1, view: null });

// The debounced search submits the GET form; outside SvelteKit that would reload the test page.
document.addEventListener('submit', (event) => event.preventDefault());

describe('Toolbar search', () => {
	it('keeps what the user is typing when an earlier search finishes loading', async () => {
		const { rerender } = await render(Toolbar, { def: movies, query: query(''), view: 'table' });
		const input = page.getByRole('searchbox', { name: 'Search Movies' });
		await userEvent.type(input, 'abc');

		// The search for "a" (sent after the first keystroke) comes back while "bc" is typed.
		await rerender({ def: movies, query: query('a'), view: 'table' });

		await expect.element(input).toHaveValue('abc');
	});

	it('shows the URL search text when the user is not typing', async () => {
		const { rerender } = await render(Toolbar, { def: movies, query: query(''), view: 'table' });
		await rerender({ def: movies, query: query('dune'), view: 'table' });
		await expect
			.element(page.getByRole('searchbox', { name: 'Search Movies' }))
			.toHaveValue('dune');
	});
});
