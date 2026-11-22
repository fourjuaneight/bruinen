<script lang="ts">
	interface Props {
		src: string;
		/** The record's title: its first letter stands in for a missing cover. */
		title: string;
		/** Empty on cards, where the title is already the link text. */
		alt: string;
		aspect: string;
		eager?: boolean;
		/** The record page's cover: bigger radius and shadow. */
		large?: boolean;
	}

	let { src, title, alt, aspect, eager = false, large = false }: Props = $props();

	let failed = $state(false);
</script>

<div
	class="frame"
	class:large
	class:empty={!src || failed}
	data-testid="cover-frame"
	style:aspect-ratio={aspect}
>
	{#if src && !failed}
		<img
			{src}
			{alt}
			loading={eager ? 'eager' : 'lazy'}
			fetchpriority={eager ? 'high' : undefined}
			decoding="async"
			onerror={() => (failed = true)}
		/>
	{:else}
		<div class="placeholder" data-testid="cover-placeholder" aria-hidden="true">
			{title.trim().slice(0, 1).toUpperCase()}
		</div>
	{/if}
</div>

<style>
	.frame {
		position: relative;
		width: 100%;
		overflow: hidden;
		border-radius: 10px;
		background: var(--placeholder);
		box-shadow: var(--cover-shadow-card);
	}
	.large {
		border-radius: 14px;
		box-shadow: var(--cover-shadow-large);
	}
	.empty {
		border: 1px dashed var(--border-strong);
		box-shadow: none;
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.placeholder {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		color: var(--muted);
		font-family: var(--font-display);
		font-size: 64px;
		font-weight: 600;
	}
	@media (max-width: 639px) {
		.large {
			border-radius: 12px;
		}
	}
</style>
