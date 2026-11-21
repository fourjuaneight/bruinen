<script lang="ts">
	import type { CollectionDef } from '../collections.ts';
	import { cellText } from '../format.ts';
	import { listHref, nextSort, sortState, type ListQuery } from '../list.ts';

	interface Props {
		def: CollectionDef;
		items: Record<string, unknown>[];
		query: ListQuery;
	}

	let { def, items, query }: Props = $props();

	const SORT_MARKS = { ascending: '▲', descending: '▼', none: '' } as const;

	const linkColumn = $derived(
		def.columns.find((c) => c.name === def.titleField)?.name ?? def.columns[0].name
	);
</script>

<div class="table-wrap">
	<!-- Explicit roles keep table semantics when the phone layout switches to display:block. -->
	<!-- svelte-ignore a11y_no_redundant_roles -->
	<table role="table">
		<caption class="visually-hidden">{def.label}</caption>
		<!-- svelte-ignore a11y_no_redundant_roles -->
		<thead role="rowgroup">
			<!-- svelte-ignore a11y_no_redundant_roles -->
			<tr role="row">
				{#each def.columns as column (column.name)}
					{#if def.sortable.includes(column.name)}
						{@const sort = sortState(query.sort, column.name)}
						<th scope="col" role="columnheader" aria-sort={sort}>
							<a href={listHref(def, query, { sort: nextSort(query.sort, column.name), page: 1 })}>
								{column.label}
								<span aria-hidden="true" class="sort-mark">{SORT_MARKS[sort]}</span>
							</a>
						</th>
					{:else}
						<th scope="col" role="columnheader">{column.label}</th>
					{/if}
				{/each}
			</tr>
		</thead>
		<!-- svelte-ignore a11y_no_redundant_roles -->
		<tbody role="rowgroup">
			{#each items as item (item.id)}
				<!-- svelte-ignore a11y_no_redundant_roles -->
				<tr role="row">
					{#each def.columns as column (column.name)}
						<td role="cell" data-label={column.label}>
							{#if column.name === linkColumn}
								<a href="/{def.name}/{item.id}">{cellText(column, item) || 'Untitled'}</a>
							{:else}
								{cellText(column, item)}
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		text-align: left;
		padding: 0.625rem 0.75rem;
		border-bottom: 1px solid var(--border);
		vertical-align: top;
	}
	th {
		font-size: 0.8125rem;
		color: var(--muted);
		white-space: nowrap;
	}
	th a {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		min-height: 2.75rem;
		color: inherit;
		text-decoration: none;
	}
	th[aria-sort='ascending'] a,
	th[aria-sort='descending'] a {
		color: var(--text);
	}
	td a {
		font-weight: 600;
	}

	@media (max-width: 639px) {
		thead {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
		}
		table,
		tbody,
		tr,
		td {
			display: block;
		}
		tr {
			padding-block: 0.5rem;
			border-bottom: 1px solid var(--border);
		}
		td {
			display: grid;
			grid-template-columns: 7rem 1fr;
			gap: 0.75rem;
			border: 0;
			padding: 0.25rem 0;
		}
		td::before {
			content: attr(data-label);
			color: var(--muted);
			font-size: 0.8125rem;
		}
		td:empty {
			display: none;
		}
	}
</style>
