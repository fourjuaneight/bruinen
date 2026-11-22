<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Sign in · Bruinen</title></svelte:head>

<main id="content" tabindex="-1" class="login">
	<p class="brand" aria-hidden="true"><span class="mark"><Icon name="logo" /></span>Bruinen</p>
	<h1>Sign in</h1>
	<p class="muted">Use your Rivendell superuser account.</p>

	<form
		method="POST"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		{#if form?.message}
			<p class="error" role="alert">{form.message}</p>
		{/if}
		<label>
			Email
			<input name="email" type="email" autocomplete="username" required value={form?.email ?? ''} />
		</label>
		<label>
			Password
			<input name="password" type="password" autocomplete="current-password" required />
		</label>
		<button type="submit" class="primary" disabled={submitting}>Sign in</button>
	</form>
</main>

<style>
	.login {
		max-width: 26rem;
		margin: 0 auto;
		padding: 64px 16px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0 0 32px;
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.mark {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 9px;
		background: var(--accent);
		color: var(--accent-text);
	}
	h1 {
		font-size: 30px;
	}
	.muted {
		margin: 8px 0 24px;
	}
	form {
		display: grid;
		gap: 16px;
		padding: 24px;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
	}
	label {
		display: grid;
		gap: 6px;
		font-size: 14px;
		font-weight: 600;
	}
	button {
		min-height: var(--control);
		margin-top: 4px;
	}
	.error {
		margin: 0;
	}
</style>
