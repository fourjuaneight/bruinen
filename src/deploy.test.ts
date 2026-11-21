import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const hasDocker = spawnSync('docker', ['compose', 'version']).status === 0;

function composeConfig(env: string) {
	const dir = mkdtempSync(join(tmpdir(), 'bruinen-compose-'));
	const envFile = join(dir, '.env');
	try {
		writeFileSync(envFile, env);
		return spawnSync('docker', ['compose', '--env-file', envFile, 'config', '-q'], {
			encoding: 'utf8',
			env: { PATH: process.env.PATH, HOME: process.env.HOME }
		});
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

describe.skipIf(!hasDocker)('docker-compose.yml', () => {
	it('refuses to start without ORIGIN, which every form POST needs for its CSRF check', () => {
		const result = composeConfig('TS_AUTHKEY=x\n');
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain('ORIGIN');
	});

	it('passes the B2 credentials through to the app', () => {
		const config = JSON.parse(
			execFileSync(
				'docker',
				['compose', '--env-file', '.env.example', 'config', '--format', 'json'],
				{
					encoding: 'utf8'
				}
			)
		);
		const env = Object.keys(config.services.app.environment);
		for (const name of ['B2_APP_KEY_ID', 'B2_APP_KEY', 'B2_BUCKET_ID', 'B2_BUCKET_NAME']) {
			expect(env).toContain(name);
		}
	});

	it('accepts a complete env file', () => {
		expect(() =>
			execFileSync('docker', ['compose', '--env-file', '.env.example', 'config', '-q'])
		).not.toThrow();
	});
});

describe('Dockerfile', () => {
	it('ships only the build: adapter-node bundles every package not listed in dependencies', () => {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
		expect(pkg.dependencies ?? {}).toEqual({});
		expect(readFileSync('Dockerfile', 'utf8')).not.toContain('node_modules');
	});

	it('raises the body size limit so 10 MB cover uploads reach the server', () => {
		expect(readFileSync('Dockerfile', 'utf8')).toMatch(/^ENV .*\bBODY_SIZE_LIMIT=12M\b/m);
	});
});
