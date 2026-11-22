<script lang="ts">
	import type { CollectionDef } from '../collections.ts';
	import { cellText, flagBadges, tagNames } from '../format.ts';
	import Chip from './Chip.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		def: CollectionDef;
		items: Record<string, unknown>[];
	}

	let { def, items }: Props = $props();

	const META_TYPES = ['text', 'number', 'date', 'url', 'select'];

	const titleColumn = $derived(
		def.columns.find((c) => c.name === def.titleField) ?? def.columns[0]
	);
	/** The plain columns after the title; the first two non-empty ones form the meta line. */
	const metaColumns = $derived(
		def.columns.filter((c) => c !== titleColumn && META_TYPES.includes(c.type))
	);
	const meta = (item: Record<string, unknown>) =>
		metaColumns
			.map((c) => cellText(c, item))
			.filter(Boolean)
			.slice(0, 2)
			.join(' · ');
</script>

<!-- The phone version of the table: one link row per record, no label/value blocks. -->
<ul class="rows">
	{#each items as item (item.id)}
		{@const line = meta(item)}
		{@const flags = flagBadges(def, item)}
		{@const tags = tagNames(item)}
		<li>
			<a href="/{def.name}/{item.id}">
				<span class="body">
					<span class="title">{cellText(titleColumn, item) || 'Untitled'}</span>
					{#if line}<span class="meta">{line}</span>{/if}
					{#if flags.length || tags.length}
						<ul class="chips">
							{#each flags as flag (flag.name)}
								<Chip as="li" size="list" flag={flag.name}>{flag.label}</Chip>
							{/each}
							{#each tags as tag (tag)}
								<Chip as="li" size="list" kind="outline-muted">{tag}</Chip>
							{/each}
						</ul>
					{/if}
				</span>
				<span class="chevron"><Icon name="chevron-right" /></span>
			</a>
		</li>
	{/each}
</ul>

<style>
	.rows {
		margin: 0;
		padding: 0;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
		list-style: none;
	}
	.rows > li + li {
		border-top: 1px solid var(--border);
	}
	a {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: var(--tap);
		padding: 14px 12px 14px 16px;
		color: var(--text);
		text-decoration: none;
	}
	a:hover {
		background: var(--hover);
	}
	.body {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}
	.title {
		font-size: 16px;
		font-weight: 600;
		line-height: 1.35;
	}
	.meta {
		margin-top: 3px;
		color: var(--muted);
		font-size: 14px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 8px 0 0;
		padding: 0;
		list-style: none;
	}
	.chevron {
		display: flex;
		color: var(--muted);
	}
</style>
