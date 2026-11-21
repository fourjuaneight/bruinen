<script lang="ts">
	import Cover from '#lib/components/Cover.svelte';
	import CoverUpload from '#lib/components/CoverUpload.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import Toast from '#lib/components/Toast.svelte';
	import { cellText, detailFields } from '#lib/format.ts';
	import { recordValues } from '#lib/forms.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const titleField = $derived(
		data.def.columns.find((c) => c.name === data.def.titleField) ?? data.def.columns[0]
	);
	const title = $derived(cellText(titleField, data.record) || 'Untitled');
	const fields = $derived(detailFields(data.def, data.record));
	const image = $derived(data.def.image ? String(data.record[data.def.image] ?? '') : '');
	const initial = $derived(recordValues(data.def, data.record));
	const updated = $derived(form && 'updated' in form ? form.updated : undefined);
	// Cover results always carry `cover`, edit results never do, so a failed upload never opens
	// the Edit dialog.
	const failure = $derived(form && !('updated' in form) && !('cover' in form) ? form : null);
	const cover = $derived(form && 'cover' in form ? form.cover : undefined);
</script>

<svelte:head><title>{title} · {data.def.label} · Bruinen</title></svelte:head>

<main id="content" tabindex="-1">
	<p><a class="button" href={data.backHref}>Back to {data.def.label}</a></p>
	<article class="record" class:has-image={data.def.image}>
		{#if data.def.image}
			<div class="cover">
				<!-- Remount after an upload: a cover replaced in place keeps its URL. -->
				{#key cover}
					<Cover src={image} alt={title} aspect={data.def.imageAspect ?? '2 / 3'} eager />
				{/key}
				{#if data.canUploadCover}
					<CoverUpload
						hasCover={Boolean(image)}
						error={cover && 'message' in cover ? cover.message : undefined}
					/>
				{/if}
			</div>
		{/if}
		<div>
			<div class="title-row">
				<h1>{title}</h1>
				<RecordDialog
					def={data.def}
					meta={data.meta}
					form={failure}
					mode="edit"
					{initial}
					heading="Edit {title}"
				/>
			</div>
			<dl>
				{#each fields as field (field.name)}
					<div class="row">
						<dt>{field.label}</dt>
						<dd>
							{#if field.href}
								<a href={field.href} target="_blank" rel="noopener noreferrer">{field.text}</a>
							{:else}
								{field.text}
							{/if}
						</dd>
					</div>
				{/each}
			</dl>
		</div>
	</article>
</main>

{#key form}
	{#if updated}
		<Toast message={updated.kind === 'updated' ? 'Saved changes' : 'No changes'} />
	{:else if cover && 'kind' in cover}
		<Toast message="Cover updated" />
	{/if}
{/key}

<style>
	.record {
		display: grid;
		gap: 1.5rem;
	}
	.cover {
		max-width: 16rem;
	}
	.title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	h1 {
		margin: 0;
		overflow-wrap: anywhere;
	}
	dl {
		margin: 0;
		display: grid;
		gap: 0.75rem;
	}
	.row {
		display: grid;
		gap: 0.125rem;
	}
	dt {
		color: var(--muted);
		font-size: 0.875rem;
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
		white-space: pre-line;
	}
	@media (min-width: 640px) {
		.record.has-image {
			grid-template-columns: 16rem minmax(0, 1fr);
		}
		.row {
			grid-template-columns: 10rem minmax(0, 1fr);
			gap: 1rem;
		}
	}
</style>
