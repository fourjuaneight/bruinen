<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		message: string;
		href?: string;
		linkText?: string;
	}

	let { message, href, linkText = 'View' }: Props = $props();
	let visible = $state(true);

	onMount(() => {
		// Under reduced motion the toast stays until dismissed rather than vanishing on its own.
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const timer = setTimeout(() => (visible = false), 6000);
		return () => clearTimeout(timer);
	});
</script>

<div class="toast" role="status" aria-live="polite" hidden={!visible}>
	<span>{message}</span>
	{#if href}<a {href}>{linkText}</a>{/if}
	<button type="button" aria-label="Dismiss" onclick={() => (visible = false)}>✕</button>
</div>

<style>
	.toast {
		position: fixed;
		left: 50%;
		bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
		transform: translateX(-50%);
		z-index: 20;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: max-content;
		max-width: calc(100vw - 2rem);
		padding: 0.5rem 0.5rem 0.5rem 1rem;
		border-radius: 10px;
		background: var(--text);
		color: var(--bg);
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.3);
	}
	.toast a {
		color: inherit;
		font-weight: 700;
	}
	.toast button {
		background: transparent;
		border-color: transparent;
		color: inherit;
	}
</style>
