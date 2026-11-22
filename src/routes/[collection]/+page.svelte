<script lang="ts">
	import CardGrid from '#lib/components/CardGrid.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Pagination from '#lib/components/Pagination.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import RecordList from '#lib/components/RecordList.svelte';
	import Toast from '#lib/components/Toast.svelte';
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
			? { message: `Added ${result.label}`, href, linkLabel: result.label }
			: {
					message: "Saved, but Rivendell couldn't fetch its metadata",
					href,
					linkLabel: result.label
				};
	});
	const failure = $derived(form && !('result' in form) ? form : null);

	const pastEnd = $derived(data.items.length === 0 && data.totalItems > 0);
	// Collections with covers default to cards; the URL can always ask for the table.
	const view = $derived(data.query.view ?? (data.def.image ? 'cards' : 'table'));
</script>

<svelte:head><title>{data.def.label} · Bruinen</title></svelte:head>

<main id="content" tabindex="-1" class:table-view={view === 'table'}>
	<div class="heading">
		<div class="title">
			<h1>{data.def.label}</h1>
			<p class="count">
				{data.totalItems.toLocaleString('en-US')}
				{data.totalItems === 1 ? 'record' : 'records'}
			</p>
		</div>
		<div class="actions">
			{#if data.def.image}
				<div class="switch" role="group" aria-label="View">
					<a
						href={listHref(data.def, data.query, { view: 'cards' })}
						aria-current={view === 'cards' ? 'page' : undefined}
					>
						<Icon name="grid" size={16} />Cards
					</a>
					<a
						href={listHref(data.def, data.query, { view: 'table' })}
						aria-current={view === 'table' ? 'page' : undefined}
					>
						<Icon name="lines" size={16} />Table
					</a>
				</div>
			{/if}
			<RecordDialog def={data.def} meta={data.meta} form={failure} />
		</div>
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
		<!-- Both render; CSS shows the table from 640px and the stacked list below it. -->
		<div class="wide"><DataTable def={data.def} items={data.items} query={data.query} /></div>
		<div class="narrow"><RecordList def={data.def} items={data.items} /></div>
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
		<Toast message={toast.message} href={toast.href} linkLabel={toast.linkLabel} />
	{/if}
{/key}

<style>
	.heading {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 24px;
	}
	.count {
		margin: 6px 0 0;
		color: var(--muted);
		font-size: 15px;
		font-variant-numeric: tabular-nums;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 16px;
	}
	@media (min-width: 640px) {
		.actions :global(.new-record) {
			min-height: 52px;
			padding: 0 20px;
		}
	}

	/* Cards/Table: a segmented control of two links. */
	.switch {
		display: flex;
		gap: 4px;
		padding: 4px;
		border-radius: 12px;
		background: var(--hover);
	}
	.switch a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: var(--tap);
		padding: 0 16px;
		border: 1px solid transparent;
		border-radius: 9px;
		color: var(--muted);
		font-size: 14px;
		font-weight: 500;
		text-decoration: none;
	}
	.switch a:hover {
		color: var(--text);
	}
	/* Border, shadow and weight mark the active half, not colour alone. */
	.switch a[aria-current='page'] {
		border-color: var(--control-border);
		background: var(--surface);
		box-shadow: var(--shadow-sm);
		color: var(--text);
		font-weight: 600;
	}

	.empty {
		padding-block: 32px;
	}

	@media (min-width: 640px) {
		.narrow {
			display: none;
		}
	}
	@media (max-width: 639px) {
		.wide {
			display: none;
		}
		.heading {
			gap: 12px;
			margin-bottom: 16px;
		}
		.title {
			display: flex;
			align-items: baseline;
			gap: 10px;
		}
		.count {
			margin: 0;
		}
		.actions,
		.switch {
			flex-basis: 100%;
		}
		.switch {
			margin-bottom: -4px;
		}
		.switch a {
			flex: 1;
		}
		/* Room for the floating Add button below the last row. */
		main {
			padding-bottom: 96px;
		}
	}
</style>
