<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { COLLECTIONS } from '#lib/collections.ts';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	const current = $derived(page.url.pathname.split('/')[1] ?? '');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a class="skip-link" href="#main">Skip to content</a>

{#if data.user}
	<div class="shell">
		<header class="app-header">
			<a class="brand" href="/">Bruinen</a>
			<form method="POST" action="/logout">
				<button type="submit">Log out</button>
			</form>
		</header>
		<nav aria-label="Collections" class="collections-nav">
			<ul>
				{#each COLLECTIONS as def (def.name)}
					<li>
						<a href="/{def.name}" aria-current={current === def.name ? 'page' : undefined}>
							{def.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
		<div class="content">
			{@render children()}
		</div>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.shell {
		display: grid;
		grid-template-areas: 'header' 'nav' 'content';
		grid-template-columns: minmax(0, 1fr);
	}
	.app-header {
		grid-area: header;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}
	.brand {
		font-weight: 700;
		font-size: 1.125rem;
		color: var(--text);
		text-decoration: none;
		min-height: var(--tap);
		display: inline-flex;
		align-items: center;
	}
	.collections-nav {
		grid-area: nav;
		overflow-x: auto;
		border-bottom: 1px solid var(--border);
	}
	.collections-nav ul {
		display: flex;
		gap: 0.5rem;
		list-style: none;
		margin: 0;
		padding: 0.5rem 1rem;
	}
	.collections-nav a {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap);
		padding: 0 0.875rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		white-space: nowrap;
		text-decoration: none;
		color: var(--text);
		background: var(--surface);
	}
	.collections-nav a[aria-current='page'] {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-text);
	}
	.content {
		grid-area: content;
		min-width: 0;
	}

	@media (min-width: 1024px) {
		.shell {
			grid-template-areas: 'header header' 'nav content';
			grid-template-columns: 14rem minmax(0, 1fr);
		}
		.collections-nav {
			border-bottom: 0;
			border-right: 1px solid var(--border);
			min-height: calc(100vh - 3.75rem);
		}
		.collections-nav ul {
			flex-direction: column;
			padding: 1rem;
		}
		.collections-nav a {
			width: 100%;
			border-radius: 10px;
		}
	}
</style>
