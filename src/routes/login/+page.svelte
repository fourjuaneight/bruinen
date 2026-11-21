<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Sign in · Bruinen</title></svelte:head>

<main id="content" tabindex="-1" class="login">
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
		<button type="submit" disabled={submitting}>Sign in</button>
	</form>
</main>

<style>
	.login {
		max-width: 24rem;
		margin: 0 auto;
		padding-block: 3rem;
	}
	form {
		display: grid;
		gap: 1rem;
	}
	label {
		display: grid;
		gap: 0.25rem;
	}
</style>
