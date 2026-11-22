<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { refreshCachedImage } from '../cover-cache.ts';
	import { coverFileError } from '../covers.ts';
	import Icon from './Icon.svelte';

	interface Props {
		hasCover: boolean;
		/** The server's message after a failed upload. */
		error?: string;
	}

	let { hasCover, error }: Props = $props();

	let form: HTMLFormElement | undefined = $state();
	let uploading = $state(false);
	let hydrated = $state(false);
	let browserError = $state<string | null>(null);
	// A newer pick replaces the server's message with the browser's own check.
	let picked = $state(false);
	const message = $derived(picked ? browserError : (error ?? null));

	onMount(() => (hydrated = true));

	function onchange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		picked = true;
		browserError = coverFileError(input.files?.[0]);
		// Browsers fire no change event for the same file twice, so clear a refused pick.
		if (browserError) input.value = '';
		else form?.requestSubmit();
	}

	const submit: SubmitFunction = ({ formElement }) => {
		uploading = true;
		return async ({ result, update }) => {
			if (result.type === 'success') {
				const cover = result.data?.cover as { url?: string } | undefined;
				if (cover?.url) await refreshCachedImage(cover.url);
			} else {
				// SvelteKit only resets the form on success; clear the pick so the same file can
				// be tried again (picking it again would fire no change event).
				formElement.reset();
			}
			uploading = false;
			picked = false;
			await update();
		};
	};
</script>

<form
	bind:this={form}
	method="POST"
	action="?/cover"
	enctype="multipart/form-data"
	use:enhance={submit}
>
	<!-- The input comes first, so its focus ring can be drawn on the label that follows. -->
	<input
		id="cover"
		class="file"
		type="file"
		name="cover"
		accept="image/jpeg"
		disabled={uploading}
		aria-invalid={message ? 'true' : undefined}
		aria-describedby={message ? 'cover-hint cover-error' : 'cover-hint'}
		{onchange}
	/>
	<label for="cover" class="button" class:busy={uploading}>
		<Icon name="upload" />
		{uploading ? 'Uploading…' : hasCover ? 'Replace cover' : 'Add cover'}
	</label>
	{#if !hydrated}
		<button type="submit">Upload</button>
	{/if}
	<p id="cover-hint" class="hint">JPEG, 10 MB or smaller</p>
	{#if message}
		<p id="cover-error" class="error">{message}</p>
	{/if}
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
	}
	label {
		width: 100%;
	}
	.file:focus-visible + label {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	label.busy {
		opacity: 0.6;
		cursor: progress;
	}
	/* Visually hidden but focusable; the label is the visible button. */
	.file {
		position: absolute;
		width: 1px;
		height: 1px;
		min-height: 0;
		padding: 0;
		opacity: 0;
		overflow: hidden;
	}
	p {
		margin: 0;
		font-size: 13px;
		text-align: center;
	}
	.hint {
		color: var(--muted);
	}
	@media (max-width: 639px) {
		label {
			min-height: var(--control);
			border-radius: 12px;
			font-size: 15px;
		}
		.hint {
			display: none;
		}
	}
</style>
