<script lang="ts">
	import type { CollectionDef } from '../collections.ts';
	import type { FormValues, RecordFormState } from '../forms.ts';
	import FieldInput from './FieldInput.svelte';

	interface Props {
		def: CollectionDef;
		meta: Partial<Record<string, string[]>>;
		form: RecordFormState | null | undefined;
		submitting: boolean;
		oncancel?: () => void;
		/** Edit shows the edit fields, prefilled from `initial`. */
		mode?: 'create' | 'edit';
		initial?: FormValues;
	}

	let { def, meta, form, submitting, oncancel, mode = 'create', initial }: Props = $props();

	const fields = $derived(mode === 'edit' ? def.edit : def.create);
	// After a failed submit, show exactly what was sent: falling back to the record per field would
	// re-check a box the user had unchecked (an unchecked box is absent from the form).
	const values = $derived(form?.values ?? initial ?? {});
	const submitLabel = $derived.by(() => {
		if (mode === 'edit') return submitting ? 'Saving…' : 'Save changes';
		return submitting
			? def.slowCreate
				? 'Archiving… this can take a few minutes'
				: 'Saving…'
			: 'Save';
	});
</script>

{#if form?.message}
	<p class="error" role="alert">{form.message}</p>
{/if}

<div class="fields">
	{#each fields as field (field.name)}
		<FieldInput
			{field}
			options={field.metaType ? (meta[field.metaType] ?? []) : []}
			value={values[field.name]}
			error={form?.fields?.[field.name]}
		/>
	{/each}
</div>

{#if mode === 'edit' && def.enriched}
	<p class="hint">Editing doesn't re-fetch covers or archives.</p>
{/if}

<div class="actions">
	<button type="button" onclick={() => oncancel?.()}>Cancel</button>
	<button type="submit" class="primary" disabled={submitting} aria-live="polite">
		{submitLabel}
	</button>
</div>

<style>
	.fields {
		display: grid;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}
	.hint {
		margin: 0 0 1rem;
		font-size: 0.875rem;
		color: var(--muted);
	}
	.actions {
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: 0.5rem;
	}
</style>
