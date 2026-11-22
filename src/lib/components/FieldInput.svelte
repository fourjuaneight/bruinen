<script lang="ts">
	import type { FieldDef } from '../collections.ts';
	import Icon from './Icon.svelte';
	import ScanButton from './ScanButton.svelte';

	interface Props {
		field: FieldDef;
		options?: readonly string[];
		value?: string | string[];
		error?: string;
	}

	let { field, options = [], value, error }: Props = $props();

	let scanned: string | undefined = $state();

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

{#if field.type === 'bool'}
	<div class="field">
		<label class="check">
			<input
				{id}
				type="checkbox"
				name={field.name}
				value="on"
				checked={value === 'on'}
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? errorId : undefined}
			/>
			{field.label}
		</label>
		{#if error}
			<p id={errorId} class="field-error">{error}</p>
		{/if}
	</div>
{:else}
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
				<ScanButton
					target={field.scan}
					label="Scan {field.label}"
					class="scan"
					ondetect={(code) => (scanned = code)}
				>
					<Icon name="scan" size={20} />Scan
				</ScanButton>
			{/if}
		</div>
		{#if field.type === 'tags'}
			<p id="{id}-hint" class="hint">Up to 5. Hold Ctrl or ⌘ to pick several on a computer.</p>
		{/if}
		{#if error}
			<p id={errorId} class="field-error">{error}</p>
		{/if}
	</div>
{/if}

<style>
	.field {
		display: grid;
		gap: 6px;
	}
	label {
		font-size: 14px;
		font-weight: 600;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: var(--tap);
		font-size: 15px;
		font-weight: 500;
		cursor: pointer;
	}
	.check input {
		width: 20px;
		height: 20px;
		min-height: 0;
		margin: 0;
		accent-color: var(--accent);
	}
	.required {
		color: var(--danger);
	}
	.control {
		display: flex;
		gap: 8px;
	}
	.control :global(.scan) {
		flex: none;
		min-height: var(--control);
		border-color: var(--control-border);
		border-radius: 12px;
		color: var(--accent);
	}
	.hint {
		margin: 0;
		color: var(--muted);
		font-size: 13px;
	}
	.field-error {
		margin: 0;
		color: var(--danger);
		font-size: 13px;
		font-weight: 500;
	}
	[aria-invalid='true'] {
		border-color: var(--danger);
	}
</style>
