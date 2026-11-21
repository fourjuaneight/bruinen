import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import Chip from './Chip.svelte';

const text = (value: string) => createRawSnippet(() => ({ render: () => `<span>${value}</span>` }));

describe('Chip', () => {
	it('shows a status with a dot, coloured by its tone', async () => {
		await render(Chip, { status: 'in_progress', children: text('In Progress') });
		const chip = page.getByText('In Progress').element().parentElement as HTMLElement;
		expect(chip.classList).toContain('progress');
		expect(chip.querySelector('.dot')).not.toBeNull();
	});

	it('marks a favorite with a heart icon', async () => {
		await render(Chip, { flag: 'favorite', children: text('Favorite') });
		const chip = page.getByText('Favorite').element().parentElement as HTMLElement;
		expect(chip.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
		expect(chip.classList).toContain('neutral');
	});

	it('shows a dead link in the danger colours', async () => {
		await render(Chip, { flag: 'dead', children: text('Dead link') });
		const chip = page.getByText('Dead link').element().parentElement as HTMLElement;
		expect(chip.classList).toContain('danger');
	});
});
