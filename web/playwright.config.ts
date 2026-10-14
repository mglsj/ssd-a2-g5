import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.WEB_URL ?? 'http://localhost:5173';

// The tests change the seeded databases (bookings, top-ups, pins), so they run one at a time.
export default defineConfig({
	testDir: 'tests',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 60_000,
	expect: { timeout: 10_000 },
	reporter: [['list']],
	use: {
		baseURL,
		trace: 'retain-on-failure',
		// Edge ships with Windows, so no Playwright browser download is needed. Set PW_CHANNEL=chromium to use Playwright's own.
		...devices['Desktop Chrome'],
		channel: process.env.PW_CHANNEL ?? 'msedge'
	},
	// Reuses a running `bun run dev`. The API must already be up in the dev container.
	webServer: {
		command: 'bun run dev',
		url: baseURL,
		reuseExistingServer: true,
		timeout: 60_000
	}
});
