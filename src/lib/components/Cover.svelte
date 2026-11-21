<script lang="ts">
	interface Props {
		src: string;
		alt: string;
		aspect: string;
		eager?: boolean;
	}

	let { src, alt, aspect, eager = false }: Props = $props();

	let failed = $state(false);
</script>

<div class="frame" data-testid="cover-frame" style="aspect-ratio: {aspect}">
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
			<span>{alt.slice(0, 1).toUpperCase()}</span>
		</div>
	{/if}
</div>

<style>
	.frame {
		width: 100%;
		overflow: hidden;
		border-radius: 10px;
		background: var(--border);
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
		font-size: 2.5rem;
		font-weight: 700;
	}
</style>
