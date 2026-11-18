<script lang="ts">
	import Cover from '#lib/components/Cover.svelte';
	import { cellText, detailFields } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const titleField = $derived(
		data.def.columns.find((c) => c.name === data.def.titleField) ?? data.def.columns[0]
	);
	const title = $derived(cellText(titleField, data.record) || 'Untitled');
	const fields = $derived(detailFields(data.def, data.record));
	const image = $derived(data.def.image ? String(data.record[data.def.image] ?? '') : '');
</script>

<svelte:head><title>{title} · {data.def.label} · Bruinen</title></svelte:head>

<main id="main">
	<p><a href={data.backHref}>Back to {data.def.label}</a></p>
	<article class="record" class:has-image={data.def.image}>
		{#if data.def.image}
			<div class="cover">
				<Cover src={image} alt={title} aspect={data.def.imageAspect ?? '2 / 3'} eager />
			</div>
		{/if}
		<div>
			<h1>{title}</h1>
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

<style>
	.record {
		display: grid;
		gap: 1.5rem;
	}
	.cover {
		max-width: 16rem;
	}
	h1 {
		margin-top: 0;
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
