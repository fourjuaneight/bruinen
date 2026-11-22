<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { COLLECTIONS, NAV_GROUPS } from '#lib/collections.ts';
	import Icon from '#lib/components/Icon.svelte';
	import { formatCount } from '#lib/format.ts';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	const current = $derived(page.url.pathname.split('/')[1] ?? '');

	let nav: HTMLElement | undefined = $state();

	// In the phone pill row, bring the current collection into view.
	afterNavigate(() => {
		if (!matchMedia('(max-width: 1023px)').matches) return;
		nav
			?.querySelector('[aria-current="page"]')
			?.scrollIntoView({ block: 'nearest', inline: 'center' });
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a class="skip-link" href="#content">Skip to content</a>

{#if data.user}
	<header class="app-header">
		<a class="brand" href="/">
			<span class="mark"><Icon name="logo" /></span>
			<span class="wordmark">Bruinen</span>
		</a>
		<form method="POST" action="/logout">
			<button type="submit" class="logout"><Icon name="logout" />Log out</button>
		</form>
	</header>
	<div class="shell">
		<nav aria-label="Collections" class="collections" bind:this={nav}>
			{#each NAV_GROUPS as group (group.id)}
				<div class="group">
					<p id="grp-{group.id}" class="group-label">{group.label}</p>
					<ul aria-labelledby="grp-{group.id}">
						{#each COLLECTIONS.filter((def) => def.group === group.id) as def (def.name)}
							<li>
								<a href="/{def.name}" aria-current={current === def.name ? 'page' : undefined}>
									<span>{def.label}</span>
									{#if data.counts[def.name] !== undefined}
										<span class="count">{formatCount(data.counts[def.name])}</span>
									{/if}
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</nav>
		<div class="content">
			{@render children()}
		</div>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.app-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		height: 64px;
		padding: 0 24px;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: var(--tap);
		color: var(--text);
		text-decoration: none;
	}
	.mark {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 9px;
		background: var(--accent);
		color: var(--accent-text);
	}
	.wordmark {
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	form {
		margin: 0;
	}
	.logout {
		padding: 0 14px;
		border-color: var(--border);
		font-weight: 500;
	}

	.shell {
		display: flex;
		flex-wrap: wrap;
		min-height: calc(100vh - 64px);
	}
	.content {
		flex: 999 1 560px;
		min-width: 0;
	}
	.collections ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.collections a {
		display: flex;
		align-items: center;
		min-height: var(--tap);
		border: 1px solid transparent;
		color: var(--text);
		font-size: 15px;
		font-weight: 500;
		text-decoration: none;
	}
	.collections a:hover {
		background: var(--hover);
	}
	/* Border and weight mark the current item, so colour is not the only sign. */
	.collections a[aria-current='page'] {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--accent-soft-text);
		font-weight: 600;
	}
	.count {
		color: var(--muted);
		font-size: 13px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}
	[aria-current='page'] .count {
		color: var(--accent-soft-text);
	}

	@media (min-width: 1024px) {
		.collections {
			flex: 0 0 248px;
			padding: 20px 12px;
			border-right: 1px solid var(--border);
			background: var(--surface);
		}
		.group {
			margin-bottom: 18px;
		}
		.group-label {
			margin: 0;
			padding: 6px 12px;
			color: var(--muted);
			font-size: 12px;
			font-weight: 600;
			letter-spacing: 0.06em;
			text-transform: uppercase;
		}
		.collections ul {
			display: flex;
			flex-direction: column;
			gap: 2px;
		}
		.collections a {
			justify-content: space-between;
			gap: 8px;
			padding: 0 12px;
			border-radius: 10px;
		}
	}

	/* Below 1024px the same nav is one scrolling row of pills. */
	@media (max-width: 1023px) {
		/* Keep the pill row at its own height; wrapped flex lines would share the min-height. */
		.shell {
			align-content: flex-start;
		}
		.collections {
			display: flex;
			flex-basis: 100%;
			/* A flex item is as wide as its content by default; the row must scroll instead. */
			min-width: 0;
			/* Contains the visually hidden group labels, which would otherwise widen the page. */
			position: relative;
			gap: 8px;
			padding: 10px 16px;
			overflow-x: auto;
			scrollbar-width: none;
			border-bottom: 1px solid var(--border);
			background: var(--surface);
		}
		.collections::-webkit-scrollbar {
			display: none;
		}
		.group,
		.collections ul {
			display: flex;
			gap: 8px;
			width: max-content;
		}
		.group-label {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
		.collections a {
			padding: 0 16px;
			border-color: var(--border);
			border-radius: 999px;
			background: var(--surface);
			white-space: nowrap;
		}
		.count {
			display: none;
		}
	}

	@media (max-width: 639px) {
		.app-header {
			height: 60px;
			padding: 0 12px 0 16px;
		}
		.shell {
			min-height: calc(100vh - 60px);
		}
		.mark {
			width: 30px;
			height: 30px;
			border-radius: 8px;
		}
		.wordmark {
			font-size: 19px;
		}
		.logout {
			border-color: transparent;
			background: transparent;
			color: var(--muted);
		}
	}
</style>
