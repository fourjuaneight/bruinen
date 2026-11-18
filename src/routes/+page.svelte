<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Bruinen</title></svelte:head>

<main id="main">
	<h1>Collections</h1>
	<ul class="grid">
		{#each data.collections as c (c.name)}
			<li>
				<a href="/{c.name}">
					<span class="label">{c.label}</span>
					<span class="count">{c.count}</span>
				</a>
			</li>
		{/each}
	</ul>
</main>

<style>
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
	}
	a {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		text-decoration: none;
	}
	.label {
		font-weight: 600;
	}
	.count {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
</style>
