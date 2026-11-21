<script lang="ts">
	import { onMount } from 'svelte';
	import { normalizeScan } from '../barcode.ts';
	import { createDefaultDetector, type Detector } from '../detector.ts';

	interface Props {
		target: 'isbn' | 'barcode';
		ondetect: (code: string) => void;
		onclose: () => void;
		createDetector?: () => Promise<Detector>;
		getStream?: () => Promise<MediaStream>;
	}

	let {
		target,
		ondetect,
		onclose,
		createDetector = createDefaultDetector,
		getStream = defaultStream
	}: Props = $props();

	let video: HTMLVideoElement | undefined = $state();
	let status = $state('Starting camera…');
	let problem = $state('');
	let torchAvailable = $state(false);
	let torchOn = $state(false);

	let stream: MediaStream | undefined;
	let active = true;

	function defaultStream(): Promise<MediaStream> {
		if (!navigator.mediaDevices?.getUserMedia) {
			return Promise.reject(new DOMException('No camera API', 'NotFoundError'));
		}
		return navigator.mediaDevices.getUserMedia({
			video: { facingMode: { ideal: 'environment' } },
			audio: false
		});
	}

	function cameraProblem(err: unknown): string {
		const name = err instanceof DOMException ? err.name : '';
		if (name === 'NotAllowedError' || name === 'SecurityError') {
			return 'Camera access was denied. Type the code instead.';
		}
		if (name === 'NotFoundError' || name === 'OverconstrainedError') {
			return 'No camera found. Type the code instead.';
		}
		return 'The camera could not start. Type the code instead.';
	}

	function stopCamera() {
		active = false;
		stream?.getTracks().forEach((track) => track.stop());
	}

	async function toggleTorch() {
		const track = stream?.getVideoTracks()[0];
		if (!track) return;
		torchOn = !torchOn;
		await track
			.applyConstraints({ advanced: [{ torch: torchOn } as MediaTrackConstraintSet] })
			.catch(() => (torchOn = !torchOn));
	}

	async function scan() {
		try {
			stream = await getStream();
		} catch (err) {
			problem = cameraProblem(err);
			return;
		}
		if (!active || !video) return stopCamera();

		video.srcObject = stream;
		await video.play().catch(() => {});
		const capabilities = stream.getVideoTracks()[0]?.getCapabilities?.() as
			{ torch?: boolean } | undefined;
		torchAvailable = Boolean(capabilities?.torch);

		let detector: Detector;
		try {
			detector = await createDetector();
		} catch {
			problem = 'Barcode scanning is not available in this browser. Type the code instead.';
			return stopCamera();
		}

		status = 'Point the camera at the barcode.';
		while (active) {
			if (video.readyState >= 2) {
				const found = await detector.detect(video).catch(() => []);
				for (const { rawValue } of found) {
					const code = normalizeScan(rawValue, target);
					if (code && active) {
						stopCamera();
						navigator.vibrate?.(50);
						ondetect(code);
						return;
					}
				}
			}
			await new Promise((resolve) => setTimeout(resolve, 150));
		}
	}

	onMount(() => {
		scan();
		return stopCamera;
	});
</script>

<div class="scanner">
	<video bind:this={video} playsinline muted autoplay aria-label="Camera preview"></video>
	<p class:error={problem} aria-live="polite">{problem || status}</p>
	<div class="actions">
		{#if torchAvailable && !problem}
			<button type="button" aria-pressed={torchOn} onclick={toggleTorch}>Light</button>
		{/if}
		<button
			type="button"
			onclick={() => {
				stopCamera();
				onclose();
			}}
		>
			Close scanner
		</button>
	</div>
</div>

<style>
	.scanner {
		display: grid;
		gap: 0.75rem;
	}
	video {
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		background: #000;
		border-radius: 10px;
	}
	p {
		margin: 0;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}
</style>
