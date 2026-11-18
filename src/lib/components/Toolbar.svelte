<script lang="ts">
	import type { CollectionDef } from '../collections.ts';
	import type { ListQuery } from '../list.ts';

	interface Props {
		def: CollectionDef;
		query: ListQuery;
	}

	let { def, query }: Props = $props();

	let form: HTMLFormElement | undefined = $state();
	let timer: ReturnType<typeof setTimeout> | undefined;

	function submitSoon() {
		clearTimeout(timer);
		timer = setTimeout(() => form?.requestSubmit(), 300);
	}

	const DATE_LIKE = new Set(['year', 'start', 'end']);

	function sortOptions(def: CollectionDef) {
		const options = [
			{
				value: def.defaultSort,
				label: def.defaultSort === '-@rowid' ? 'Recently added' : 'Default order'
			}
		];
		for (const field of def.sortable) {
			const column = def.columns.find((c) => c.name === field);
			const label = column?.label ?? field;
			const numeric = column?.type === 'number' || column?.type === 'date';
			const [up, down] = DATE_LIKE.has(field)
				? ['oldest first', 'newest first']
				: numeric
					? ['low to high', 'high to low']
					: ['A–Z', 'Z–A'];
			for (const [value, dir] of [
				[field, up],
				[`-${field}`, down]
			]) {
				if (value !== def.defaultSort) options.push({ value, label: `${label} (${dir})` });
			}
		}
		return options;
	}
</script>

<form
	bind:this={form}
	method="GET"
	action="/{def.name}"
	class="toolbar"
	role="search"
	data-sveltekit-keepfocus
	data-sveltekit-replacestate
>
	<label class="search">
		<span class="visually-hidden">Search {def.label}</span>
		<input
			type="search"
			name="q"
			value={query.q}
			placeholder="Search {def.label.toLowerCase()}"
			oninput={submitSoon}
		/>
	</label>
	<label class="sort">
		<span>Sort by</span>
		<select name="sort" value={query.sort} onchange={() => form?.requestSubmit()}>
			{#each sortOptions(def) as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</label>
	{#if query.view}
		<input type="hidden" name="view" value={query.view} />
	{/if}
	<button type="submit">Search</button>
</form>

<style>
	.toolbar {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem;
		align-items: end;
	}
	.search {
		grid-column: 1;
	}
	.sort {
		grid-column: 1 / -1;
		display: grid;
		gap: 0.25rem;
		font-size: 0.875rem;
		color: var(--muted);
	}
	.sort select {
		color: var(--text);
	}
	button {
		grid-row: 1;
		grid-column: 2;
	}
	@media (min-width: 640px) {
		.sort {
			display: none;
		}
	}
</style>
