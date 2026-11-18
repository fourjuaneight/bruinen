import { defineConfig, devices } from '@playwright/test';

const MOCK_PB = 'http://127.0.0.1:8099';
const APP = 'http://localhost:4173';

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.spec.ts',
	fullyParallel: false,
	workers: 1,
	use: { baseURL: APP, trace: 'retain-on-failure' },
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile-webkit', use: { ...devices['iPhone 15'] } }
	],
	webServer: [
		{
			command: 'node tests/e2e/mock-pb/server.ts',
			url: `${MOCK_PB}/api/health`,
			reuseExistingServer: !process.env.CI
		},
		{
			command: 'npm run build && node build',
			url: `${APP}/`,
			env: { ORIGIN: APP, PORT: '4173', POCKETBASE_URL: MOCK_PB },
			reuseExistingServer: !process.env.CI,
			timeout: 180_000
		}
	]
});
