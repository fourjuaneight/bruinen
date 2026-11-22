<script lang="ts">
	import type { CollectionDef, FieldDef } from '../collections.ts';
	import { cellText, flagBadges, nameOf, titleCase } from '../format.ts';
	import { listHref, nextSort, sortCaption, sortState, type ListQuery } from '../list.ts';
	import Chip from './Chip.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		def: CollectionDef;
		items: Record<string, unknown>[];
		query: ListQuery;
	}

	let { def, items, query }: Props = $props();

	const linkColumn = $derived(
		def.columns.find((c) => c.name === def.titleField)?.name ?? def.columns[0].name
	);
	// The flags share one "Flags" column of badges instead of a Yes column each.
	const columns = $derived(def.columns.filter((c) => c.type !== 'bool'));
	const hasFlags = $derived(def.edit.some((f) => f.type === 'bool'));
	const muted = (column: FieldDef) =>
		column.name !== linkColumn && ['text', 'number', 'date'].includes(column.type);
	const tagNames = (item: Record<string, unknown>) => {
		const tags = (item.expand as Record<string, unknown> | undefined)?.tags;
		return Array.isArray(tags) ? tags.map(nameOf).filter(Boolean) : [];
	};
</script>

<div class="table-wrap">
	<table>
		<caption class="visually-hidden">{sortCaption(def, query.sort)}</caption>
		<thead>
			<tr>
				{#each columns as column (column.name)}
					{#if def.sortable.includes(column.name)}
						{@const sort = sortState(query.sort, column.name)}
						<th scope="col" aria-sort={sort}>
							<a href={listHref(def, query, { sort: nextSort(query.sort, column.name), page: 1 })}>
								{column.label}
								{#if sort !== 'none'}
									<Icon name={sort === 'ascending' ? 'chevron-up' : 'chevron-down'} size={14} />
								{/if}
							</a>
						</th>
					{:else}
						<th scope="col">{column.label}</th>
					{/if}
				{/each}
				{#if hasFlags}<th scope="col">Flags</th>{/if}
			</tr>
		</thead>
		<tbody>
			{#each items as item (item.id)}
				<tr>
					{#each columns as column (column.name)}
						<td class:muted={muted(column)}>
							{#if column.name === linkColumn}
								<a class="title" href="/{def.name}/{item.id}">
									{cellText(column, item) || 'Untitled'}
								</a>
							{:else if column.type === 'tags'}
								<ul class="chips">
									{#each tagNames(item) as tag (tag)}<Chip as="li" kind="tag">{tag}</Chip>{/each}
								</ul>
							{:else if column.name === 'status' && cellText(column, item)}
								<Chip status={cellText(column, item)}>{titleCase(cellText(column, item))}</Chip>
							{:else}
								{cellText(column, item)}
							{/if}
						</td>
					{/each}
					{#if hasFlags}
						<td>
							<ul class="chips">
								{#each flagBadges(def, item) as flag (flag.name)}
									<Chip as="li" flag={flag.name}>{flag.label}</Chip>
								{/each}
							</ul>
						</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
	}
	table {
		width: 100%;
		min-width: 760px;
		border-collapse: collapse;
		font-size: 15px;
	}
	th {
		height: 48px;
		padding: 0 16px;
		border-bottom: 1px solid var(--border);
		background: var(--bg);
		color: var(--muted);
		font-size: 13px;
		font-weight: 600;
		text-align: left;
		white-space: nowrap;
	}
	th a {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: var(--tap);
		color: inherit;
		text-decoration: none;
	}
	th a:hover,
	th[aria-sort='ascending'],
	th[aria-sort='descending'] {
		color: var(--text);
	}
	td {
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
	}
	th:first-child,
	td:first-child {
		padding-left: 20px;
	}
	td:last-child {
		padding-right: 20px;
	}
	tbody tr:last-child td {
		border-bottom: 0;
	}
	tbody tr:hover {
		background: var(--hover);
	}
	.muted {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.title {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap);
		color: var(--text);
		font-weight: 600;
		text-decoration: none;
	}
	.title:hover {
		color: var(--accent);
		text-decoration: underline;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
