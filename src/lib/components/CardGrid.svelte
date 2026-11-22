<script lang="ts">
	import type { CollectionDef } from '../collections.ts';
	import { cardExtra, cellText, flagBadges, titleCase } from '../format.ts';
	import Chip from './Chip.svelte';
	import Cover from './Cover.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		def: CollectionDef;
		items: Record<string, unknown>[];
	}

	let { def, items }: Props = $props();

	const column = (name: string) => def.columns.find((c) => c.name === name);
	const titleColumn = $derived(column(def.titleField) ?? def.columns[0]);
	const subtitleColumn = $derived(def.columns.find((c) => c !== titleColumn && c.type === 'text'));
	const yearColumn = $derived(column('year'));
	const statusColumn = $derived(column('status'));
</script>

<ul class="cards">
	{#each items as item (item.id)}
		{@const title = cellText(titleColumn, item) || 'Untitled'}
		{@const subtitle = subtitleColumn ? cellText(subtitleColumn, item) : ''}
		{@const year = yearColumn ? cellText(yearColumn, item) : ''}
		{@const status = statusColumn ? cellText(statusColumn, item) : ''}
		{@const extra = cardExtra(def, item)}
		{@const favorite = flagBadges(def, item).some((flag) => flag.name === 'favorite')}
		<li>
			<a class="card" href="/{def.name}/{item.id}">
				<div class="cover">
					<Cover
						src={String(item[def.image ?? 'cover'] ?? '')}
						{title}
						alt=""
						aspect={def.imageAspect ?? '2 / 3'}
					/>
					{#if favorite}
						<span class="fav-badge">
							<Icon name="heart" size={16} /><span class="visually-hidden">Favorite</span>
						</span>
					{/if}
				</div>
				<div>
					<p class="title">{title}</p>
					{#if subtitle || year}
						<!-- Phones show the creator only; the year joins it from 640px. -->
						<p class="subtitle">
							{subtitle}{#if year}<span class="year">{subtitle ? ' · ' : ''}{year}</span>{/if}
						</p>
					{/if}
					{#if status || extra}
						<div class="chips">
							{#if status}<Chip {status}>{titleCase(status)}</Chip>{/if}
							{#if extra}<Chip kind="tag">{extra}</Chip>{/if}
						</div>
					{/if}
				</div>
			</a>
		</li>
	{/each}
</ul>

<style>
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(164px, 1fr));
		gap: 36px 24px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 12px;
		color: var(--text);
		text-decoration: none;
	}
	.cover {
		position: relative;
	}
	.fav-badge {
		position: absolute;
		top: 8px;
		right: 8px;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 999px;
		/* Fixed in both themes: it sits on the cover image, not the page. */
		background: rgba(255, 255, 255, 0.94);
		color: #d6336c;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}
	p {
		margin: 0;
	}
	.title {
		font-size: 15px;
		font-weight: 600;
		line-height: 1.35;
	}
	.card:hover .title {
		text-decoration: underline;
	}
	.subtitle {
		margin-top: 2px;
		color: var(--muted);
		font-size: 14px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 8px;
	}
	@media (prefers-reduced-motion: no-preference) {
		.cover {
			transition: transform 0.15s ease;
		}
		.card:hover .cover {
			transform: translateY(-3px);
		}
	}
	@media (max-width: 639px) {
		.cards {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 24px 14px;
		}
		.card {
			gap: 10px;
		}
		.year {
			display: none;
		}
	}
</style>
