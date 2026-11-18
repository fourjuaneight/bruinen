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
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				permissions: ['camera'],
				// Chromium's fake camera plays a still of an EAN-13 barcode (see tests/e2e/fixtures).
				launchOptions: {
					args: [
						'--use-fake-ui-for-media-stream',
						'--use-fake-device-for-media-stream',
						'--use-file-for-fake-video-capture=tests/e2e/fixtures/ean13.y4m'
					]
				}
			}
		},
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
