<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { refreshCachedImage } from '../cover-cache.ts';
	import { coverFileError } from '../covers.ts';

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
		if (!browserError) form?.requestSubmit();
	}

	const submit: SubmitFunction = () => {
		uploading = true;
		return async ({ result, update }) => {
			if (result.type === 'success') {
				const cover = result.data?.cover as { url?: string } | undefined;
				if (cover?.url) await refreshCachedImage(cover.url);
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
	<label class="button" class:busy={uploading}>
		<input
			type="file"
			name="cover"
			accept="image/jpeg"
			disabled={uploading}
			aria-invalid={message ? 'true' : undefined}
			aria-describedby={message ? 'cover-error' : undefined}
			{onchange}
		/>
		{uploading ? 'Uploading…' : hasCover ? 'Replace cover' : 'Add cover'}
	</label>
	{#if !hydrated}
		<button type="submit">Upload</button>
	{/if}
	{#if message}
		<p id="cover-error" class="error">{message}</p>
	{/if}
</form>

<style>
	form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	label {
		position: relative;
	}
	label:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	label.busy {
		opacity: 0.6;
		cursor: progress;
	}
	/* Visually hidden but focusable; the label is the visible button. */
	input {
		position: absolute;
		width: 1px;
		height: 1px;
		min-height: 0;
		padding: 0;
		opacity: 0;
		overflow: hidden;
	}
	p {
		flex-basis: 100%;
		margin: 0;
	}
</style>
