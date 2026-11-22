<script lang="ts">
	import Chip from '#lib/components/Chip.svelte';
	import Cover from '#lib/components/Cover.svelte';
	import CoverUpload from '#lib/components/CoverUpload.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import Toast from '#lib/components/Toast.svelte';
	import { cellText, recordSections } from '#lib/format.ts';
	import { recordValues } from '#lib/forms.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const titleField = $derived(
		data.def.columns.find((c) => c.name === data.def.titleField) ?? data.def.columns[0]
	);
	const title = $derived(cellText(titleField, data.record) || 'Untitled');
	const sections = $derived(recordSections(data.def, data.record));
	const image = $derived(data.def.image ? String(data.record[data.def.image] ?? '') : '');
	const initial = $derived(recordValues(data.def, data.record));
	const updated = $derived(form && 'updated' in form ? form.updated : undefined);
	// Cover results always carry `cover`, edit results never do, so a failed upload never opens
	// the Edit dialog.
	const failure = $derived(form && !('updated' in form) && !('cover' in form) ? form : null);
	const cover = $derived(form && 'cover' in form ? form.cover : undefined);
</script>

<svelte:head><title>{title} · {data.def.label} · Bruinen</title></svelte:head>

{#snippet fieldList(fields: typeof sections.details)}
	<dl>
		{#each fields as field (field.name)}
			<div class="row">
				<dt>{field.label}</dt>
				<dd>
					{#if field.href}
						<a href={field.href} target="_blank" rel="noopener noreferrer">
							{field.text}<Icon name="external" size={14} /><span class="visually-hidden">
								(opens in a new tab)
							</span>
						</a>
					{:else}
						{field.text}
					{/if}
				</dd>
			</div>
		{/each}
	</dl>
{/snippet}

<main id="content" tabindex="-1">
	<div class="page">
		<a class="button back" href={data.backHref}>
			<Icon name="chevron-left" />Back to {data.def.label}
		</a>
		<article class="record" class:has-image={data.def.image} class:can-upload={data.canUploadCover}>
			{#if data.def.image}
				<div class="cover-column">
					<div class="cover">
						<!-- Remount after an upload: a cover replaced in place keeps its URL. -->
						{#key cover}
							<Cover
								src={image}
								{title}
								alt="Cover of {title}"
								aspect={data.def.imageAspect ?? '2 / 3'}
								eager
								large
							/>
						{/key}
					</div>
					{#if data.canUploadCover}
						<div class="upload">
							<CoverUpload
								hasCover={Boolean(image)}
								error={cover && 'message' in cover ? cover.message : undefined}
							/>
						</div>
					{/if}
				</div>
			{/if}
			<div class="details-column">
				<div class="title-row">
					<div class="title">
						<h1>{title}</h1>
						{#if sections.subtitle}<p class="subtitle">{sections.subtitle}</p>{/if}
					</div>
					<div class="edit">
						<RecordDialog
							def={data.def}
							meta={data.meta}
							form={failure}
							mode="edit"
							{initial}
							heading="Edit {title}"
						/>
					</div>
				</div>
				{#if sections.badges.length}
					<ul class="badges" aria-label="Status and flags">
						{#each sections.badges as badge, i (i)}
							{#if badge.kind === 'status'}
								<Chip as="li" size="lg" status={badge.value}>{badge.text}</Chip>
							{:else if badge.kind === 'flag'}
								<Chip as="li" size="lg" flag={badge.name}>{badge.text}</Chip>
							{:else}
								<Chip as="li" size="lg" kind="outline">{badge.text}</Chip>
							{/if}
						{/each}
					</ul>
				{/if}
				<div class="sections">
					{#if sections.details.length}
						<section aria-labelledby="sec-details">
							<div class="section-header"><h2 id="sec-details">Details</h2></div>
							{@render fieldList(sections.details)}
						</section>
					{/if}
					{#if sections.enriched.length}
						<section aria-labelledby="sec-rivendell">
							<div class="section-header">
								<h2 id="sec-rivendell">From Rivendell</h2>
								<span class="note"><Icon name="enriched" size={14} />Added by Rivendell</span>
							</div>
							{@render fieldList(sections.enriched)}
						</section>
					{/if}
				</div>
			</div>
		</article>
	</div>
</main>

{#key form}
	{#if updated}
		<Toast message={updated.kind === 'updated' ? 'Saved changes' : 'No changes'} />
	{:else if cover && 'kind' in cover}
		<Toast message="Cover updated" />
	{/if}
{/key}

<style>
	.page {
		max-width: 1120px;
		margin: 0 auto;
	}
	main {
		padding-top: 28px;
	}
	.back {
		gap: 6px;
		margin-bottom: 28px;
		padding: 0 14px 0 10px;
		border-color: var(--border);
	}
	.record {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 48px;
	}
	.cover-column {
		display: flex;
		flex: 0 0 288px;
		flex-direction: column;
		gap: 14px;
	}
	.details-column {
		display: flex;
		flex: 1 1 480px;
		flex-direction: column;
		gap: 24px;
		min-width: 0;
	}
	.title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}
	.title {
		min-width: 0;
	}
	h1 {
		font-size: 40px;
	}
	.subtitle {
		margin: 8px 0 0;
		color: var(--muted);
		font-size: 17px;
	}
	.edit {
		flex: none;
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.sections {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	section {
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
	}
	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}
	h2 {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}
	.note {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--muted);
		font-size: 13px;
	}
	dl {
		margin: 0;
	}
	.row {
		display: grid;
		grid-template-columns: 160px minmax(0, 1fr);
		gap: 16px;
		padding: 14px 20px;
	}
	.row + .row {
		border-top: 1px solid var(--border);
	}
	dt {
		color: var(--muted);
		font-size: 14px;
	}
	dd {
		margin: 0;
		font-size: 15px;
		line-height: 1.55;
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	dd a {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: var(--tap);
		margin: -11px 0;
		font-weight: 500;
	}

	@media (max-width: 639px) {
		main {
			padding-top: 12px;
		}
		.back {
			margin-bottom: 8px;
			padding: 0 8px 0 0;
			border-color: transparent;
			background: transparent;
		}
		/*
		 * One DOM for both layouts: the columns and title row dissolve into one grid, which
		 * orders it as cover, title, badges, Edit + Replace cover side by side, then sections.
		 */
		.record {
			display: grid;
			grid-template-columns: 1fr 1fr;
			grid-template-areas: 'title title' 'badges badges' 'edit edit' 'sections sections';
			gap: 20px 10px;
		}
		.record.has-image {
			grid-template-areas: 'cover cover' 'title title' 'badges badges' 'edit edit' 'sections sections';
		}
		.record.has-image.can-upload {
			grid-template-areas: 'cover cover' 'title title' 'badges badges' 'edit upload' 'sections sections';
		}
		.cover-column,
		.details-column,
		.title-row {
			display: contents;
		}
		.cover {
			grid-area: cover;
			justify-self: center;
			width: 208px;
		}
		.upload {
			grid-area: upload;
		}
		.title {
			grid-area: title;
			text-align: center;
		}
		h1 {
			font-size: 28px;
			line-height: 1.15;
		}
		.subtitle {
			font-size: 16px;
		}
		.edit {
			grid-area: edit;
		}
		.edit :global(.edit-record) {
			width: 100%;
			min-height: var(--control);
			border-color: var(--accent);
			border-radius: 12px;
			background: var(--accent);
			color: var(--accent-text);
			font-size: 15px;
		}
		.badges {
			grid-area: badges;
			justify-content: center;
		}
		.sections {
			grid-area: sections;
			gap: 16px;
		}
		.section-header {
			padding: 14px 16px;
		}
		.row {
			display: block;
			padding: 12px 16px;
		}
		dt {
			margin-bottom: 3px;
			font-size: 13px;
		}
		dd {
			font-size: 16px;
		}
		dd a {
			margin: 0;
		}
	}
</style>
