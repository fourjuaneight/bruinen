<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if data.user}
	<header class="app-header">
		<a class="brand" href="/">Bruinen</a>
		<form method="POST" action="/logout">
			<button type="submit">Log out</button>
		</form>
	</header>
{/if}

{@render children()}
