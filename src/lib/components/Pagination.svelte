<script lang="ts">
	import type { CollectionDef } from '../collections.ts';
	import { listHref, type ListQuery } from '../list.ts';

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
			← Prev
		</a>
	{:else}
		<span></span>
	{/if}
	<span>Page {query.page} of {totalPages}</span>
	{#if query.page < totalPages}
		<a class="button" href={listHref(def, query, { page: query.page + 1 })} aria-label="Next page">
			Next →
		</a>
	{:else}
		<span></span>
	{/if}
</nav>

<style>
	.pagination {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 0.5rem;
		padding-block: 1rem;
	}
	.pagination > :last-child {
		justify-self: end;
	}
</style>
