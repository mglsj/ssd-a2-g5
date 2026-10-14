import tailwindcss from '@tailwindcss/vite';
import adapter from "@sveltejs/adapter-bun";
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	// The typed client lives in ../api. Resolve its hono import from web's node_modules.
	resolve: { dedupe: ['hono'] },
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Builds a standalone Bun server into build/. It only runs under Bun.
			adapter: adapter()
		})
	]
});
