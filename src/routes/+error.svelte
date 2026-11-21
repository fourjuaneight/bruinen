<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} · Bruinen</title></svelte:head>

<main id="content" tabindex="-1" class="error-page">
	<p class="status">{page.status}</p>
	<h1>{page.error?.message}</h1>
	{#if page.status === 401}
		<p>
			<a href="/login?next={encodeURIComponent(page.url.pathname + page.url.search)}">
				Sign in again
			</a>
		</p>
	{:else}
		<p><a href="/">Back to collections</a></p>
	{/if}
</main>
