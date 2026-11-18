import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BarcodeScanner from './BarcodeScanner.svelte';

/** A real MediaStream (from a canvas) so <video> can play it in the test browser. */
function canvasStream() {
	const canvas = document.createElement('canvas');
	canvas.width = 64;
	canvas.height = 48;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, 64, 48);
	const stream = canvas.captureStream(10);
	const tick = setInterval(() => ctx.fillRect(0, 0, 64, 48), 50);
	return { stream, stop: () => clearInterval(tick) };
}

function detectorReturning(...codes: (string | null)[]) {
	return async () => ({
		detect: async () => {
			const next = codes.length > 1 ? codes.shift() : codes[0];
			return next ? [{ rawValue: next }] : [];
		}
	});
}

describe('BarcodeScanner', () => {
	it('explains a denied camera and offers to close', async () => {
		const onclose = vi.fn();
		render(BarcodeScanner, {
			// `target` is also a Svelte mount option, so props must be passed explicitly.
			props: {
				target: 'isbn',
				ondetect: vi.fn(),
				onclose,
				getStream: () => Promise.reject(new DOMException('denied', 'NotAllowedError')),
				createDetector: detectorReturning(null)
			}
		});
		await expect
			.element(page.getByText('Camera access was denied. Type the code instead.'))
			.toBeInTheDocument();
		await page.getByRole('button', { name: 'Close scanner' }).click();
		expect(onclose).toHaveBeenCalledOnce();
	});

	it('reports the first valid code once and stops the camera', async () => {
		const { stream, stop } = canvasStream();
		const ondetect = vi.fn();
		render(BarcodeScanner, {
			// `target` is also a Svelte mount option, so props must be passed explicitly.
			props: {
				target: 'isbn',
				ondetect,
				onclose: vi.fn(),
				getStream: async () => stream,
				createDetector: detectorReturning(null, '9780451524935')
			}
		});
		await vi.waitFor(() => expect(ondetect).toHaveBeenCalledWith('9780451524935'), 5000);
		await new Promise((r) => setTimeout(r, 300));
		expect(ondetect).toHaveBeenCalledOnce();
		expect(stream.getTracks().every((t) => t.readyState === 'ended')).toBe(true);
		stop();
	});

	it('ignores codes that are not valid for the field and keeps scanning', async () => {
		const { stream, stop } = canvasStream();
		const ondetect = vi.fn();
		render(BarcodeScanner, {
			// `target` is also a Svelte mount option, so props must be passed explicitly.
			props: {
				target: 'isbn',
				ondetect,
				onclose: vi.fn(),
				getStream: async () => stream,
				createDetector: detectorReturning('0828768199121', '0451524934')
			}
		});
		await vi.waitFor(() => expect(ondetect).toHaveBeenCalledWith('9780451524935'), 5000);
		expect(ondetect).toHaveBeenCalledOnce();
		stop();
	});
});
