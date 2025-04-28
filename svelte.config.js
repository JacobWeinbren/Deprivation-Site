// svelte.config.js
import adapter from "@sveltejs/adapter-vercel"; // Import the Vercel adapter
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Use the Vercel adapter
		adapter: adapter({
			// Optional Vercel adapter config:
			// runtime: 'nodejs18.x', // Specify Node.js runtime if needed
			// edge: false, // Set to true for Vercel Edge Functions
			// split: false, // Set to true to split functions (experimental)
		}),
		// You can add other kit options here if needed, like 'alias'
		// alias: {
		//   '$components': 'src/lib/components',
		// }
	},
	// Note: Vite-specific config like resolve.alias goes in vite.config.js
};

export default config;
