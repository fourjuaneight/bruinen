import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Icon from './Icon.svelte';

describe('Icon', () => {
	it('draws a decorative stroke icon at the given size', async () => {
		const { container } = await render(Icon, { name: 'search', size: 18 });
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('aria-hidden')).toBe('true');
		expect(svg?.getAttribute('width')).toBe('18');
		expect(svg?.getAttribute('stroke')).toBe('currentColor');
		expect(svg?.querySelector('circle')).not.toBeNull();
	});

	it('fills the heart instead of stroking it', async () => {
		const { container } = await render(Icon, { name: 'heart', size: 16 });
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('fill')).toBe('currentColor');
		expect(svg?.getAttribute('stroke')).toBe('none');
	});
});
