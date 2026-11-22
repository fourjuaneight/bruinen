<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';

	interface Props {
		message: string;
		href?: string;
		/** The record the View link opens, read after "View" by screen readers. */
		linkLabel?: string;
	}

	let { message, href, linkLabel }: Props = $props();
	let visible = $state(true);

	onMount(() => {
		// Under reduced motion the toast stays until dismissed rather than vanishing on its own.
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const timer = setTimeout(() => (visible = false), 6000);
		return () => clearTimeout(timer);
	});
</script>

<div class="toast" role="status" aria-live="polite" hidden={!visible}>
	<Icon name="check" />
	<span class="message">{message}</span>
	{#if href}
		<a {href}>
			View{#if linkLabel}<span class="visually-hidden"> {linkLabel}</span>{/if}
		</a>
	{/if}
	<button type="button" aria-label="Dismiss" onclick={() => (visible = false)}>
		<Icon name="close" />
	</button>
</div>

<style>
	.toast {
		position: fixed;
		left: 50%;
		bottom: calc(32px + env(safe-area-inset-bottom, 0px));
		z-index: 20;
		display: flex;
		align-items: center;
		gap: 12px;
		width: max-content;
		max-width: calc(100vw - 32px);
		padding: 6px 6px 6px 18px;
		border-radius: 14px;
		background: var(--toast-bg);
		color: var(--toast-text);
		box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
		font-size: 15px;
		font-weight: 500;
		transform: translateX(-50%);
	}
	.toast[hidden] {
		display: none;
	}
	a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 10px;
		color: var(--toast-link);
		font-weight: 700;
		text-decoration: none;
	}
	a:hover {
		color: var(--toast-link);
		text-decoration: underline;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	button {
		width: 44px;
		height: 44px;
		padding: 0;
		border: 0;
		border-radius: 10px;
		background: transparent;
		color: inherit;
	}
	button:hover {
		background: transparent;
		color: inherit;
		opacity: 0.8;
	}
	@media (max-width: 639px) {
		.toast {
			left: 16px;
			right: 16px;
			bottom: calc(96px + env(safe-area-inset-bottom, 0px));
			width: auto;
			gap: 10px;
			padding: 4px 4px 4px 16px;
			transform: none;
		}
		.message {
			flex: 1;
		}
	}
</style>
