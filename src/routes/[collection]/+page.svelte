<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import Pagination from '#lib/components/Pagination.svelte';
	import Toolbar from '#lib/components/Toolbar.svelte';
	import { listHref } from '#lib/list.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const pastEnd = $derived(data.items.length === 0 && data.totalItems > 0);
</script>

<svelte:head><title>{data.def.label} · Bruinen</title></svelte:head>

<main id="main">
	<div class="heading">
		<h1>{data.def.label}</h1>
		<span class="muted">{data.totalItems} {data.totalItems === 1 ? 'record' : 'records'}</span>
	</div>

	<Toolbar def={data.def} query={data.query} />

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

<style>
	.heading {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	h1 {
		margin: 0.5rem 0;
	}
	.empty {
		padding-block: 2rem;
	}
</style>
