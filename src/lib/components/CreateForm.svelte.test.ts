import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getCollection, type CollectionDef } from '../collections.ts';
import CreateForm from './CreateForm.svelte';

const movies = getCollection('movies') as CollectionDef;
const articles = getCollection('articles') as CollectionDef;
const meta = {
	genre: ['drama', 'sci-fi'],
	definition: ['4k'],
	status: ['not_started'],
	tags: ['go', 'tech']
};

describe('CreateForm', () => {
	it('renders one labelled control per create field', async () => {
		render(CreateForm, { def: movies, meta, form: null, submitting: false });
		for (const field of movies.create) {
			const role =
				field.type === 'number'
					? 'spinbutton'
					: field.type === 'meta' || field.type === 'select'
						? 'combobox'
						: field.type === 'tags'
							? 'listbox'
							: 'textbox';
			await expect
				.element(page.getByRole(role, { name: field.label, exact: true }))
				.toBeInTheDocument();
		}
	});

	it('offers meta fields as selects of existing names', async () => {
		render(CreateForm, { def: movies, meta, form: null, submitting: false });
		const genre = page.getByRole('combobox', { name: 'Genre' });
		await expect.element(genre.getByRole('option', { name: 'sci-fi' })).toBeInTheDocument();
	});

	it('offers tags as a multi-select', async () => {
		render(CreateForm, { def: articles, meta, form: null, submitting: false });
		await expect.element(page.getByRole('listbox', { name: /Tags/ })).toHaveAttribute('multiple');
	});

	it('marks a field with its server error', async () => {
		render(CreateForm, {
			def: movies,
			meta,
			form: {
				message: 'Please fix the highlighted fields.',
				fields: { title: 'Required' },
				values: {}
			},
			submitting: false
		});
		const title = page.getByRole('textbox', { name: /Title/ });
		await expect.element(title).toHaveAttribute('aria-invalid', 'true');
		await expect.element(title).toHaveAccessibleDescription('Required');
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Please fix the highlighted fields.');
	});

	it('keeps what the user typed after a failed submit', async () => {
		render(CreateForm, {
			def: articles,
			meta,
			form: { message: 'x', fields: {}, values: { title: 'Kept', tags: ['tech'] } },
			submitting: false
		});
		await expect.element(page.getByRole('textbox', { name: /Title/ })).toHaveValue('Kept');
		const tech = page.getByRole('option', { name: 'tech' });
		await expect.element(tech).toBeInTheDocument();
		expect((tech.element() as HTMLOptionElement).selected).toBe(true);
	});

	it('locks the submit button with the archiving copy while a slow create runs', async () => {
		render(CreateForm, { def: articles, meta, form: null, submitting: true });
		const button = page.getByRole('button', { name: 'Archiving… this can take a few minutes' });
		await expect.element(button).toBeDisabled();
	});
});
