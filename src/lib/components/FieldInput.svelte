<script lang="ts">
	import type { FieldDef } from '../collections.ts';
	import BarcodeScanner from './BarcodeScanner.svelte';

	interface Props {
		field: FieldDef;
		options?: readonly string[];
		value?: string | string[];
		error?: string;
	}

	let { field, options = [], value, error }: Props = $props();

	let scanDialog: HTMLDialogElement | undefined = $state();
	let scanButton: HTMLButtonElement | undefined = $state();
	let scanning = $state(false);
	let scanned: string | undefined = $state();

	function openScanner() {
		scanning = true;
		scanDialog?.showModal();
	}

	const id = $derived(`field-${field.name}`);
	const errorId = $derived(`${id}-error`);
	const selected = $derived(Array.isArray(value) ? value : value ? [value] : []);
	const text = $derived(Array.isArray(value) ? value.join(', ') : (value ?? ''));
	const inputType = $derived(
		field.type === 'number'
			? 'number'
			: field.type === 'url'
				? 'url'
				: field.type === 'date'
					? 'date'
					: 'text'
	);
</script>

<div class="field">
	<label for={id}>
		{field.label}{#if field.required}<span aria-hidden="true" class="required"> *</span>{/if}
	</label>
	<div class="control">
		{#if field.type === 'textarea'}
			<textarea
				{id}
				name={field.name}
				rows="3"
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? errorId : undefined}>{text}</textarea
			>
		{:else if field.type === 'meta' || field.type === 'select'}
			<select
				{id}
				name={field.name}
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? errorId : undefined}
			>
				<option value="">{field.required ? 'Choose…' : 'None'}</option>
				{#each field.options ?? options as option (option)}
					<option value={option} selected={selected.includes(option)}>{option}</option>
				{/each}
			</select>
		{:else if field.type === 'tags'}
			<select
				{id}
				name={field.name}
				multiple
				size={Math.min(6, Math.max(3, options.length))}
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? `${errorId} ${id}-hint` : `${id}-hint`}
			>
				{#each options as option (option)}
					<option value={option} selected={selected.includes(option)}>{option}</option>
				{/each}
			</select>
		{:else}
			<input
				{id}
				name={field.name}
				type={inputType}
				inputmode={field.type === 'number' || field.scan ? 'numeric' : undefined}
				value={scanned ?? text}
				placeholder={field.type === 'json' ? 'Go, Postgres' : undefined}
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? errorId : undefined}
			/>
		{/if}
		{#if field.scan}
			<button
				type="button"
				bind:this={scanButton}
				aria-label="Scan {field.label}"
				onclick={openScanner}
			>
				Scan
			</button>
		{/if}
	</div>
	{#if field.scan}
		<dialog
			bind:this={scanDialog}
			aria-label="Scan {field.label}"
			class="scan-dialog"
			onclose={() => {
				scanning = false;
				scanButton?.focus();
			}}
		>
			{#if scanning}
				<BarcodeScanner
					target={field.scan}
					ondetect={(code) => {
						scanned = code;
						scanDialog?.close();
					}}
					onclose={() => scanDialog?.close()}
				/>
			{/if}
		</dialog>
	{/if}
	{#if field.type === 'tags'}
		<p id="{id}-hint" class="hint">Up to 5. Hold Ctrl or ⌘ to pick several on a computer.</p>
	{/if}
	{#if error}
		<p id={errorId} class="field-error">{error}</p>
	{/if}
</div>

<style>
	.field {
		display: grid;
		gap: 0.25rem;
	}
	label {
		font-weight: 600;
	}
	.required {
		color: var(--danger);
	}
	.control {
		display: flex;
		gap: 0.5rem;
	}
	.hint {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.scan-dialog {
		width: min(32rem, 100vw - 2rem);
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
	}
	.field-error {
		margin: 0;
		color: var(--danger);
		font-size: 0.875rem;
	}
	[aria-invalid='true'] {
		border-color: var(--danger);
	}
</style>
