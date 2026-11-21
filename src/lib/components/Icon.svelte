<script lang="ts" module>
	/** Path data from the design spec (docs/superpowers/specs/2026-11-21-redesign.md §2.5). */
	const PATHS = {
		logo: ['M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0', 'M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0'],
		search: ['m20 20-3.5-3.5'],
		plus: ['M12 5v14M5 12h14'],
		logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
		grid: [],
		lines: ['M3 6h18M3 12h18M3 18h18'],
		'chevron-down': ['m6 9 6 6 6-6'],
		'chevron-up': ['m18 15-6-6-6 6'],
		'chevron-left': ['m15 18-6-6 6-6'],
		'chevron-right': ['m9 18 6-6-6-6'],
		heart: ['M12 20.5 4.6 13.2a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9a4.6 4.6 0 0 1 6.5 6.5z'],
		scan: [
			'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2',
			'M7 8v8M10.5 8v8M14 8v8M17 8v8'
		],
		pencil: ['M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z', 'm13.5 6.5 4 4'],
		upload: ['M12 16V4', 'm7 9 5-5 5 5', 'M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3'],
		external: [
			'M14 4h6v6',
			'M20 4 10 14',
			'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'
		],
		enriched: [
			'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6'
		],
		'dead-link': ['M11 6l1-1a4 4 0 0 1 6 6l-1 1', 'M13 18l-1 1a4 4 0 0 1-6-6l1-1', 'M4 4l16 16'],
		check: ['m5 12 5 5 9-10'],
		close: ['M18 6 6 18M6 6l12 12']
	} as const;

	export type IconName = keyof typeof PATHS;

	/** Icons the spec draws with a heavier stroke. */
	const HEAVY: ReadonlySet<IconName> = new Set(['plus', 'check', 'chevron-up', 'chevron-down']);
</script>

<script lang="ts">
	interface Props {
		name: IconName;
		size?: number;
		/** Overrides the default stroke width (2, or 2.4 for the heavy icons). */
		stroke?: number;
	}

	let { name, size = 18, stroke }: Props = $props();

	const filled = $derived(name === 'heart');
	const strokeWidth = $derived(stroke ?? (name === 'logo' ? 2.2 : HEAVY.has(name) ? 2.4 : 2));
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill={filled ? 'currentColor' : 'none'}
	stroke={filled ? 'none' : 'currentColor'}
	stroke-width={filled ? undefined : strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if name === 'search'}<circle cx="11" cy="11" r="7" />{/if}
	{#if name === 'grid'}
		{#each [[3, 3], [14, 3], [3, 14], [14, 14]] as [x, y] (`${x},${y}`)}
			<rect {x} {y} width="7" height="7" rx="1.5" />
		{/each}
	{/if}
	{#each PATHS[name] as d (d)}<path {d} />{/each}
</svg>
