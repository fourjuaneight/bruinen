import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const hasDocker = spawnSync('docker', ['compose', 'version']).status === 0;

function composeConfig(env: string) {
	const dir = mkdtempSync(join(tmpdir(), 'bruinen-compose-'));
	const envFile = join(dir, '.env');
	writeFileSync(envFile, env);
	return spawnSync('docker', ['compose', '--env-file', envFile, 'config', '-q'], {
		encoding: 'utf8',
		env: { PATH: process.env.PATH, HOME: process.env.HOME }
	});
}

describe.skipIf(!hasDocker)('docker-compose.yml', () => {
	it('refuses to start without ORIGIN, which every form POST needs for its CSRF check', () => {
		const result = composeConfig('TS_AUTHKEY=x\n');
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain('ORIGIN');
	});

	it('accepts a complete env file', () => {
		expect(() =>
			execFileSync('docker', ['compose', '--env-file', '.env.example', 'config', '-q'])
		).not.toThrow();
	});
});
