<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import type { CollectionDef } from '../collections.ts';
	import type { FormValues, RecordFormState } from '../forms.ts';
	import RecordForm from './RecordForm.svelte';

	interface Props {
		def: CollectionDef;
		meta: Partial<Record<string, string[]>>;
		form: RecordFormState | null | undefined;
		/** Edit opens the edit fields prefilled from `initial` and posts to ?/update. */
		mode?: 'create' | 'edit';
		initial?: FormValues;
		/** Dialog heading; defaults to "New <label>" or "Edit". */
		heading?: string;
	}

	let { def, meta, form, mode = 'create', initial, heading }: Props = $props();

	const title = $derived(heading ?? (mode === 'edit' ? 'Edit' : `New ${def.label}`));
	const titleId = $derived(`${mode}-title`);
	const dialogId = $derived(`${mode}-dialog`);
	// Each close resets the edit form to the record, so a cancelled edit leaves no trace.
	// The create form keeps a cancelled draft, as before.
	let closes = $state(0);

	let dialog: HTMLDialogElement | undefined = $state();
	let opener: HTMLButtonElement | undefined = $state();
	let submitting = $state(false);

	// After a failed submit without JS the page re-renders with errors: show the dialog then.
	const failed = $derived(Boolean(form && !form.pending && (form.message || form.fields)));

	onMount(() => {
		if (dialog?.open) {
			dialog.close();
			dialog.showModal();
		}
	});

	// Light dismiss: close when a click both starts and ends on the backdrop. Starting inside
	// (e.g. selecting text in an input and releasing outside) must not close the form, and
	// clicks from the nested scan dialog never target this dialog itself.
	let pressedOnBackdrop = false;

	function onBackdrop(event: PointerEvent | MouseEvent) {
		if (!dialog || event.target !== dialog) return false;
		const box = dialog.getBoundingClientRect();
		return (
			event.clientX < box.left ||
			event.clientX > box.right ||
			event.clientY < box.top ||
			event.clientY > box.bottom
		);
	}

	const submit: SubmitFunction = () => {
		submitting = true;
		return async ({ result, update }) => {
			submitting = false;
			const done =
				result.type === 'success' || (result.type === 'failure' && Boolean(result.data?.pending));
			if (done) dialog?.close();
			await update();
		};
	};
</script>

<button
	type="button"
	class={mode === 'edit' ? 'edit-record' : 'primary new-record'}
	bind:this={opener}
	commandfor={dialogId}
	command="show-modal"
>
	{mode === 'edit' ? 'Edit' : `New ${def.label}`}
</button>

<!-- WebKit does not restore focus on close, so send it back to the opener explicitly. -->
<dialog
	bind:this={dialog}
	id={dialogId}
	aria-labelledby={titleId}
	open={failed}
	onclose={() => {
		if (mode === 'edit') closes += 1;
		opener?.focus();
	}}
	onpointerdown={(event) => (pressedOnBackdrop = onBackdrop(event))}
	onclick={(event) => {
		if (pressedOnBackdrop && onBackdrop(event)) dialog?.close();
		pressedOnBackdrop = false;
	}}
>
	<div class="dialog-header">
		<h2 id={titleId}>{title}</h2>
		<button type="button" aria-label="Close" commandfor={dialogId} command="close">✕</button>
	</div>
	{#key closes}
		<form
			method="POST"
			action={mode === 'edit' ? '?/update' : '?/create'}
			novalidate
			use:enhance={submit}
		>
			<RecordForm
				{def}
				{meta}
				{form}
				{submitting}
				{mode}
				{initial}
				oncancel={() => dialog?.close()}
			/>
		</form>
	{/key}
</dialog>

<style>
	dialog {
		width: min(36rem, 100vw - 2rem);
		max-height: calc(100dvh - 2rem);
		padding: 1rem 1.25rem 1.25rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.45);
	}
	.dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}
	h2 {
		margin: 0;
		font-size: 1.25rem;
	}
	@media (max-width: 639px) {
		.new-record {
			position: fixed;
			right: 1rem;
			bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
			z-index: 5;
			box-shadow: 0 4px 12px rgb(0 0 0 / 0.25);
			border-radius: 999px;
			padding-inline: 1.25rem;
		}
	}
</style>
