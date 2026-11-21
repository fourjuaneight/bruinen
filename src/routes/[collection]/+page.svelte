<script lang="ts">
	import CardGrid from '#lib/components/CardGrid.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import Toast from '#lib/components/Toast.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import Pagination from '#lib/components/Pagination.svelte';
	import Toolbar from '#lib/components/Toolbar.svelte';
	import { listHref } from '#lib/list.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const toast = $derived.by(() => {
		if (form && 'pending' in form && form.pending) {
			return { message: 'Still processing in Rivendell — refresh later' };
		}
		const result = form && 'result' in form ? form.result : undefined;
		if (!result || !('id' in result)) return null;
		const href = `/${data.def.name}/${result.id}`;
		return result.kind === 'created'
			? { message: `Added ${result.label}`, href }
			: { message: "Saved, but Rivendell couldn't fetch its metadata", href };
	});
	const failure = $derived(form && !('result' in form) ? form : null);

	const pastEnd = $derived(data.items.length === 0 && data.totalItems > 0);
	// Collections with covers default to cards; the URL can always ask for the table.
	const view = $derived(data.query.view ?? (data.def.image ? 'cards' : 'table'));
</script>

<svelte:head><title>{data.def.label} · Bruinen</title></svelte:head>

<main id="main">
	<div class="heading">
		<h1>{data.def.label}</h1>
		<span class="muted">{data.totalItems} {data.totalItems === 1 ? 'record' : 'records'}</span>
		<RecordDialog def={data.def} meta={data.meta} form={failure} />
		{#if data.def.image}
			<nav class="view-toggle" aria-label="View">
				<a
					class="button"
					href={listHref(data.def, data.query, { view: 'cards' })}
					aria-current={view === 'cards' ? 'page' : undefined}
				>
					Cards
				</a>
				<a
					class="button"
					href={listHref(data.def, data.query, { view: 'table' })}
					aria-current={view === 'table' ? 'page' : undefined}
				>
					Table
				</a>
			</nav>
		{/if}
	</div>

	<Toolbar def={data.def} query={data.query} {view} />

	{#if pastEnd}
		<p class="empty">
			Nothing on this page.
			<a href={listHref(data.def, data.query, { page: 1 })}>Go to the first page</a>
		</p>
	{:else if data.items.length === 0}
		<p class="empty">
			{data.query.q
				? `No ${data.def.label.toLowerCase()} match “${data.query.q}”.`
				: `No ${data.def.label.toLowerCase()} yet.`}
		</p>
	{:else if view === 'cards'}
		<CardGrid def={data.def} items={data.items} />
	{:else}
		<DataTable def={data.def} items={data.items} query={data.query} />
	{/if}

	{#if data.totalPages > 1 && !pastEnd}
		<Pagination
			def={data.def}
			query={{ ...data.query, page: data.page }}
			totalPages={data.totalPages}
		/>
	{/if}
</main>

{#key form}
	{#if toast}
		<Toast message={toast.message} href={toast.href} />
	{/if}
{/key}

<style>
	.heading {
		display: flex;
		align-items: center;
		gap: 0.5rem 0.75rem;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}
	h1 {
		margin: 0.5rem 0;
	}
	/* A segmented control: two joined halves, the height of the search field below it. */
	.view-toggle {
		display: flex;
		margin-left: auto;
	}
	.view-toggle a {
		color: var(--muted);
		min-width: 5.5rem;
	}
	.view-toggle a:first-child {
		border-radius: 10px 0 0 10px;
	}
	.view-toggle a:last-child {
		border-radius: 0 10px 10px 0;
		margin-left: -1px;
	}
	.view-toggle a[aria-current='page'] {
		position: relative;
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-text);
		font-weight: 600;
	}
	@media (max-width: 639px) {
		/* Full width on phones, so its edges line up with the search row and sort select. */
		.view-toggle {
			flex-basis: 100%;
		}
		.view-toggle a {
			flex: 1;
		}
	}
	.empty {
		padding-block: 2rem;
	}
	@media (max-width: 639px) {
		main {
			padding-bottom: 5rem;
		}
	}
</style>
