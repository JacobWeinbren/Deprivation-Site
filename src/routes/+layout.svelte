<!-- src/routes/+layout.svelte -->
<script lang="ts">
	// Import global styles required by libraries
	import "maplibre-gl/dist/maplibre-gl.css"; // Base MapLibre styles
	import "@maplibre/maplibre-gl-compare/dist/maplibre-gl-compare.css"; // MapLibre Compare plugin styles

	// Import your own global styles if you have them
	import "../app.css"; // Example: Your global app styles

	// You might have other layout logic here (e.g., header, footer, stores)
</script>

<!-- Your layout structure (e.g., header, main content slot, footer) -->
<div class="flex flex-col min-h-screen">
	<!-- <header>...</header> -->

	<main class="flex-grow">
		<slot />
		<!-- This renders the content of your +page.svelte -->
	</main>

	<!-- <footer>...</footer> -->
</div>
