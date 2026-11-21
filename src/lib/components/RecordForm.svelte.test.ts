import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getCollection, type CollectionDef } from '../collections.ts';
import RecordForm from './RecordForm.svelte';

const movies = getCollection('movies') as CollectionDef;
const articles = getCollection('articles') as CollectionDef;
const books = getCollection('books') as CollectionDef;
const meta = {
	genre: ['drama', 'sci-fi'],
	definition: ['4k'],
	status: ['not_started'],
	tags: ['go', 'tech']
};

describe('RecordForm', () => {
	it('renders one labelled control per create field', async () => {
		render(RecordForm, { def: movies, meta, form: null, submitting: false });
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
		render(RecordForm, { def: movies, meta, form: null, submitting: false });
		const genre = page.getByRole('combobox', { name: 'Genre' });
		await expect.element(genre.getByRole('option', { name: 'sci-fi' })).toBeInTheDocument();
	});

	it('offers tags as a multi-select', async () => {
		render(RecordForm, { def: articles, meta, form: null, submitting: false });
		await expect.element(page.getByRole('listbox', { name: /Tags/ })).toHaveAttribute('multiple');
	});

	it('marks a field with its server error', async () => {
		render(RecordForm, {
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
		render(RecordForm, {
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
		render(RecordForm, { def: articles, meta, form: null, submitting: true });
		const button = page.getByRole('button', { name: 'Archiving… this can take a few minutes' });
		await expect.element(button).toBeDisabled();
	});

	it('cancels without submitting', async () => {
		const oncancel = vi.fn();
		render(RecordForm, { def: movies, meta, form: null, submitting: false, oncancel });
		const cancel = page.getByRole('button', { name: 'Cancel' });
		await expect.element(cancel).toHaveAttribute('type', 'button');
		await cancel.click();
		expect(oncancel).toHaveBeenCalledOnce();
	});

	describe('edit mode', () => {
		const initial = {
			title: 'Dune',
			author: 'Frank Herbert',
			status: 'not_started',
			favorite: 'on'
		};
		const bookMeta = { genre: ['fiction'], status: ['not_started', 'completed'] };

		it('prefills from the record, with flags as checkboxes', async () => {
			render(RecordForm, {
				def: books,
				meta: bookMeta,
				form: null,
				submitting: false,
				mode: 'edit',
				initial
			});
			await expect.element(page.getByRole('textbox', { name: /Title/ })).toHaveValue('Dune');
			await expect
				.element(page.getByRole('combobox', { name: 'Status' }))
				.toHaveValue('not_started');
			await expect.element(page.getByRole('checkbox', { name: 'Favorite' })).toBeChecked();
		});

		it('shows the failed submit instead of the record', async () => {
			render(RecordForm, {
				def: books,
				meta: bookMeta,
				form: { message: 'x', fields: {}, values: { title: 'Typed' } },
				submitting: false,
				mode: 'edit',
				initial
			});
			await expect.element(page.getByRole('textbox', { name: /Title/ })).toHaveValue('Typed');
			// The user unchecked Favorite before submitting; the record's 'on' must not come back.
			await expect.element(page.getByRole('checkbox', { name: 'Favorite' })).not.toBeChecked();
		});

		const editProps = { def: articles, meta, form: null, mode: 'edit' as const, initial: {} };

		it('labels the submit button for saving changes', async () => {
			render(RecordForm, { ...editProps, submitting: false });
			await expect.element(page.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
		});

		it('says Saving… while an edit runs, without the archiving copy', async () => {
			render(RecordForm, { ...editProps, submitting: true });
			await expect.element(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
		});
	});
});
