<script lang="ts">
	import { COLLECTIONS, NAV_GROUPS } from '#lib/collections.ts';
	import { formatCount } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Bruinen</title></svelte:head>

<main id="content" tabindex="-1">
	<h1>Collections</h1>
	{#each NAV_GROUPS as group (group.id)}
		<section aria-labelledby="home-{group.id}">
			<h2 id="home-{group.id}">{group.label}</h2>
			<ul class="grid">
				{#each COLLECTIONS.filter((def) => def.group === group.id) as def (def.name)}
					<li>
						<a href="/{def.name}">
							<span class="label">{def.label}</span>
							{#if data.counts[def.name] !== undefined}
								<span class="count">{formatCount(data.counts[def.name])}</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</main>

<style>
	h1 {
		margin-bottom: 8px;
	}
	h2 {
		margin: 28px 0 12px;
		color: var(--muted);
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	a {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		min-height: var(--tap);
		padding: 16px 18px;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
		color: var(--text);
		text-decoration: none;
	}
	a:hover {
		background: var(--hover);
	}
	.label {
		font-weight: 600;
	}
	.count {
		color: var(--muted);
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}
</style>
