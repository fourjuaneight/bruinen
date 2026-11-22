<script lang="ts">
	import { tick, untrack } from 'svelte';
	import type { CollectionDef } from '../collections.ts';
	import { sortOptions, type ListQuery } from '../list.ts';
	import Icon from './Icon.svelte';
	import ScanButton from './ScanButton.svelte';

	interface Props {
		def: CollectionDef;
		query: ListQuery;
		/** The view on screen; the sort select is only redundant when table headers can sort. */
		view: 'table' | 'cards';
	}

	let { def, query, view }: Props = $props();

	let form: HTMLFormElement | undefined = $state();
	let input: HTMLInputElement | undefined = $state();
	let timer: ReturnType<typeof setTimeout> | undefined;

	// The field owns its text while the user types. A search result arriving mid-typing must not
	// overwrite newer keystrokes, so the URL's q only flows in when the field isn't focused.
	let text = $state(untrack(() => query.q));
	$effect.pre(() => {
		const q = query.q;
		if (!input || document.activeElement !== input) text = q;
	});

	function submitSoon() {
		clearTimeout(timer);
		timer = setTimeout(() => form?.requestSubmit(), 300);
	}

	const options = $derived(sortOptions(def));

	/** The field a scanned code belongs in; collections without one get no scan button. */
	const scanTarget = $derived(def.create.find((f) => f.scan)?.scan);

	async function searchFor(code: string) {
		text = code;
		await tick();
		form?.requestSubmit();
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
	<div class="search">
		<div class="field" class:has-scan={scanTarget}>
			<label for="q" class="visually-hidden">Search {def.label}</label>
			<span class="search-icon"><Icon name="search" /></span>
			<input
				id="q"
				bind:this={input}
				bind:value={text}
				type="search"
				name="q"
				placeholder="Search {def.label.toLowerCase()}"
				oninput={submitSoon}
			/>
			{#if scanTarget}
				<ScanButton
					target={scanTarget}
					label="Scan a barcode to search"
					class="scan-search"
					needsCamera
					ondetect={searchFor}
				>
					<Icon name="scan" size={20} />
				</ScanButton>
			{/if}
		</div>
		<button type="submit" class="submit">Search</button>
	</div>
	<div class="sort" class:headers-sort={view === 'table'}>
		<label for="sort">Sort by</label>
		<select id="sort" name="sort" value={query.sort} onchange={() => form?.requestSubmit()}>
			{#each options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</div>
	{#if query.view}
		<input type="hidden" name="view" value={query.view} />
	{/if}
</form>

<style>
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-bottom: 32px;
	}
	:global(main.table-view) .toolbar {
		margin-bottom: 24px;
	}
	.search {
		display: flex;
		flex: 1 1 320px;
		gap: 12px;
	}
	.field {
		position: relative;
		flex: 1;
		min-width: 0;
	}
	.field input {
		padding-left: 46px;
	}
	.has-scan input {
		padding-right: 52px;
	}
	.search-icon {
		position: absolute;
		top: 50%;
		left: 16px;
		display: flex;
		color: var(--muted);
		transform: translateY(-50%);
		pointer-events: none;
	}
	.field :global(.scan-search) {
		position: absolute;
		top: 2px;
		right: 2px;
		padding: 0;
		border-color: transparent;
		background: transparent;
		color: var(--accent);
	}
	.submit {
		min-height: var(--control);
		padding: 0 18px;
		border-radius: 12px;
		font-size: 15px;
	}
	.sort {
		position: relative;
		display: flex;
		flex: 0 0 280px;
		align-items: center;
	}
	.sort label {
		position: absolute;
		left: 16px;
		color: var(--muted);
		font-size: 13px;
		font-weight: 600;
		pointer-events: none;
	}
	.sort select {
		padding-left: 76px;
	}

	@media (min-width: 640px) {
		/* Scanning to search is a phone feature. */
		.field :global(.scan-search) {
			display: none;
		}
		.has-scan input {
			padding-right: 14px;
		}
		.sort.headers-sort {
			display: none;
		}
	}
	@media (max-width: 639px) {
		.toolbar {
			flex-direction: column;
			gap: 10px;
			margin-bottom: 20px;
		}
		.search {
			flex: none;
			gap: 10px;
		}
		.field input {
			padding-left: 42px;
		}
		.search-icon {
			left: 14px;
		}
		.sort {
			flex: none;
		}
		.sort label {
			left: 14px;
		}
		.sort select {
			padding-left: 74px;
		}
	}
</style>
