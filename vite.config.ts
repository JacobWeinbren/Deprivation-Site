// vite.config.js
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			// Map the 'events' module to the browser-friendly package
			events: "events",
		},
	},
	optimizeDeps: {
		// Explicitly include 'events' for Vite's pre-bundling
		include: ["events"],
	},
	// Add other Vite config if needed
	// server: {
	// 	port: 3000,
	// },
});
