<script lang="ts">
	import type { CollectionDef } from '../collections.ts';
	import { cardExtra, cellText } from '../format.ts';
	import Cover from './Cover.svelte';

	interface Props {
		def: CollectionDef;
		items: Record<string, unknown>[];
	}

	let { def, items }: Props = $props();

	const titleColumn = $derived(
		def.columns.find((c) => c.name === def.titleField) ?? def.columns[0]
	);
	const subtitleColumn = $derived(def.columns.find((c) => c !== titleColumn && c.type === 'text'));
	const title = (item: Record<string, unknown>) => cellText(titleColumn, item) || 'Untitled';
</script>

<ul class="cards">
	{#each items as item (item.id)}
		<li>
			<a href="/{def.name}/{item.id}">
				<Cover
					src={String(item[def.image ?? 'cover'] ?? '')}
					alt={title(item)}
					aspect={def.imageAspect ?? '2 / 3'}
				/>
				<span class="title">{title(item)}</span>
				{#if subtitleColumn && cellText(subtitleColumn, item)}
					<span class="subtitle">{cellText(subtitleColumn, item)}</span>
				{/if}
				{#if cardExtra(def, item)}
					<span class="extra">{cardExtra(def, item)}</span>
				{/if}
			</a>
		</li>
	{/each}
</ul>

<style>
	.cards {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
	}
	a {
		display: grid;
		gap: 0.375rem;
		color: var(--text);
		text-decoration: none;
	}
	.title {
		font-weight: 600;
		line-height: 1.3;
	}
	.subtitle,
	.extra {
		color: var(--muted);
		font-size: 0.875rem;
	}
	.extra {
		font-weight: 600;
		letter-spacing: 0.02em;
	}
	a:hover .title {
		text-decoration: underline;
	}
</style>
