<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} · Bruinen</title></svelte:head>

<main id="content" tabindex="-1" class="error-page">
	<p class="status">{page.status}</p>
	<h1>{page.error?.message}</h1>
	{#if page.status === 401}
		<p>
			<a
				class="button primary"
				href="/login?next={encodeURIComponent(page.url.pathname + page.url.search)}"
			>
				Sign in again
			</a>
		</p>
	{:else}
		<p><a class="button" href="/">Back to collections</a></p>
	{/if}
</main>

<style>
	.status {
		margin: 24px 0 8px;
		color: var(--muted);
		font-family: var(--font-display);
		font-size: 64px;
		font-weight: 600;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	h1 {
		margin-bottom: 24px;
	}
</style>
