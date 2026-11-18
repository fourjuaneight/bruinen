<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} · Bruinen</title></svelte:head>

<main id="main" class="error-page">
	<p class="status">{page.status}</p>
	<h1>{page.error?.message}</h1>
	<p><a href="/">Back to collections</a></p>
</main>
