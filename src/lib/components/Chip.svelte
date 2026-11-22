<script lang="ts">
	import type { Snippet } from 'svelte';
	import { statusTone, type FlagName } from '../format.ts';
	import Icon from './Icon.svelte';

	interface Props {
		children: Snippet;
		/** A status value from Meta: picks the tone and adds the dot. */
		status?: string;
		/** A flag badge: Favorite gets a heart, Dead link the danger colours. */
		flag?: FlagName;
		/** A tag (filled) or a pick-one vocabulary value (outlined). */
		kind?: 'tag' | 'outline' | 'outline-muted';
		size?: 'sm' | 'lg' | 'list';
		/** Render as a list item, for chip rows that are lists. */
		as?: 'span' | 'li';
	}

	let { children, status, flag, kind, size = 'sm', as = 'span' }: Props = $props();

	const tone = $derived(
		status !== undefined ? statusTone(status) : flag === 'dead' ? 'danger' : flag ? 'neutral' : kind
	);
	const icon = $derived(flag === 'favorite' ? 'heart' : flag === 'dead' ? 'dead-link' : undefined);
</script>

<svelte:element this={as} class="chip {tone ?? ''} {size}">
	{#if status !== undefined}<span class="dot"></span>{/if}
	{#if icon}<span class="icon" class:fav={icon === 'heart'}>
			<Icon name={icon} size={13} />
		</span>{/if}
	{@render children()}
</svelte:element>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 10px;
		border: 1px solid transparent;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 600;
		line-height: 1.4;
		white-space: nowrap;
	}
	.lg {
		gap: 7px;
		padding: 6px 12px;
		font-size: 13px;
	}
	.list {
		padding: 2px 9px;
	}
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: currentColor;
	}
	.lg .dot {
		width: 7px;
		height: 7px;
	}
	.icon {
		display: inline-flex;
	}
	.fav {
		color: var(--fav);
	}
	.progress {
		background: var(--accent-soft);
		color: var(--accent-soft-text);
	}
	.ok {
		background: var(--ok-soft);
		color: var(--ok);
	}
	.idle {
		background: var(--hover);
		color: var(--muted);
	}
	.neutral,
	.tag {
		background: var(--hover);
		color: var(--text);
	}
	.tag {
		font-weight: 500;
	}
	.danger {
		background: var(--danger-soft);
		color: var(--danger);
	}
	.outline {
		border-color: var(--border-strong);
		color: var(--text);
		font-weight: 500;
	}
	.outline-muted {
		border-color: var(--border);
		color: var(--muted);
		font-weight: 500;
	}
</style>
