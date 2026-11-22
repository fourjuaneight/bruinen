<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import BarcodeScanner from './BarcodeScanner.svelte';

	interface Props {
		target: 'isbn' | 'barcode';
		/** Accessible name of the button and the dialog, e.g. "Scan ISBN". */
		label: string;
		ondetect: (code: string) => void;
		children: Snippet;
		class?: string;
		/**
		 * Keep the button hidden until script runs and the browser has a camera API. Without
		 * either it could never work, and with no JS it must not show at all.
		 */
		needsCamera?: boolean;
	}

	let {
		target,
		label,
		ondetect,
		children,
		class: className,
		needsCamera = false
	}: Props = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let button: HTMLButtonElement | undefined = $state();
	let scanning = $state(false);
	let available = $state(false);

	onMount(() => {
		available = !needsCamera || Boolean(navigator.mediaDevices?.getUserMedia);
	});

	function open() {
		scanning = true;
		dialog?.showModal();
	}
</script>

<button
	type="button"
	class={className}
	bind:this={button}
	aria-label={label}
	hidden={needsCamera && !available}
	onclick={open}
>
	{@render children()}
</button>

<dialog
	bind:this={dialog}
	aria-label={label}
	class="scan-dialog"
	onclose={() => {
		scanning = false;
		button?.focus();
	}}
>
	{#if scanning}
		<BarcodeScanner
			{target}
			ondetect={(code) => {
				dialog?.close();
				ondetect(code);
			}}
			onclose={() => dialog?.close()}
		/>
	{/if}
</dialog>

<style>
	.scan-dialog {
		width: min(32rem, 100vw - 2rem);
		padding: 16px;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
		color: var(--text);
	}
	.scan-dialog::backdrop {
		background: rgb(0 0 0 / 0.45);
	}
</style>
