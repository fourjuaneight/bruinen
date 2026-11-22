<script lang="ts">
	import type { CollectionDef } from '../collections.ts';
	import { listHref, type ListQuery } from '../list.ts';
	import Icon from './Icon.svelte';

	interface Props {
		def: CollectionDef;
		query: ListQuery;
		totalPages: number;
	}

	let { def, query, totalPages }: Props = $props();
</script>

<nav aria-label="Pagination" class="pagination">
	{#if query.page > 1}
		<a
			class="button"
			href={listHref(def, query, { page: query.page - 1 })}
			aria-label="Previous page"
		>
			<Icon name="chevron-left" size={16} />Previous
		</a>
	{:else}
		<span class="button disabled" role="link" aria-disabled="true">
			<Icon name="chevron-left" size={16} />Previous
		</span>
	{/if}
	<span class="pages">Page {query.page} of {totalPages}</span>
	{#if query.page < totalPages}
		<a class="button" href={listHref(def, query, { page: query.page + 1 })} aria-label="Next page">
			Next<Icon name="chevron-right" size={16} />
		</a>
	{:else}
		<span class="button disabled" role="link" aria-disabled="true">
			Next<Icon name="chevron-right" size={16} />
		</span>
	{/if}
</nav>

<style>
	.pagination {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-top: 48px;
		padding-top: 24px;
		border-top: 1px solid var(--border);
	}
	:global(main.table-view) .pagination {
		margin-top: 32px;
		padding-top: 0;
		border-top: 0;
	}
	.button {
		padding: 0 16px;
		font-size: 15px;
	}
	.disabled {
		border-color: var(--border);
		opacity: 0.6;
		cursor: default;
	}
	.disabled:hover {
		background: var(--surface);
	}
	.pages {
		color: var(--muted);
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}
</style>
