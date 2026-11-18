<script lang="ts">
	import type { CollectionDef } from '../collections.ts';
	import type { CreateFormState } from '../forms.ts';
	import FieldInput from './FieldInput.svelte';

	interface Props {
		def: CollectionDef;
		meta: Partial<Record<string, string[]>>;
		form: CreateFormState | null | undefined;
		submitting: boolean;
	}

	let { def, meta, form, submitting }: Props = $props();

	const submitLabel = $derived(
		submitting ? (def.slowCreate ? 'Archiving… this can take a few minutes' : 'Saving…') : 'Save'
	);
</script>

{#if form?.message}
	<p class="error" role="alert">{form.message}</p>
{/if}

<div class="fields">
	{#each def.create as field (field.name)}
		<FieldInput
			{field}
			options={field.metaType ? (meta[field.metaType] ?? []) : []}
			value={form?.values?.[field.name]}
			error={form?.fields?.[field.name]}
		/>
	{/each}
</div>

<button type="submit" class="primary" disabled={submitting} aria-live="polite">
	{submitLabel}
</button>

<style>
	.fields {
		display: grid;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}
	button {
		width: 100%;
	}
</style>
