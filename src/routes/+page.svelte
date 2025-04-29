<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { browser } from "$app/environment";

	// Import components
	import ConstituencyScatter from "$lib/components/scatter/ConstituencyScatter.svelte";
	import ConstituencyCompareMap from "$lib/components/map/ConstituencyCompareMap.svelte"; // Corrected path

	// Import UI components
	import Header from "$lib/components/ui/Header.svelte";
	import SearchBox from "$lib/components/ui/SearchBox.svelte";
	import HighlightBadge from "$lib/components/ui/HighlightBadge.svelte";
	import SelectionControls from "$lib/components/ui/SelectionControls.svelte";
	import TabSelector from "$lib/components/ui/TabSelector.svelte";
	import ErrorDisplay from "$lib/components/ui/ErrorDisplay.svelte";
	import Footer from "$lib/components/ui/Footer.svelte";

	// Import config
	import {
		metrics,
		parties,
		partyColors,
		type ConstituencyData,
	} from "$lib/components/scatter/chartConfig"; // Corrected path

	// Import type for data loaded from the server
	import type { PageData } from "./$types";

	// Import the public environment variable
	import { PUBLIC_MAPBOX_TOKEN } from "$env/static/public";
	const mapboxToken = PUBLIC_MAPBOX_TOKEN;

	// Data loaded from +page.server.ts via the load function
	export let data: PageData;
	const chartData: ConstituencyData[] = data?.chartData ?? [];
	const error = data?.error ?? null;
	let isLoadingData = true; // Assume loading initially

	// --- State for Active Tab ---
	let activeTab: "scatter" | "compare" = "scatter";

	// --- State for Selections (SHARED) ---
	let selectedParty = "lab_voteshare";
	let selectedMetric = "overall_local_score";

	// --- State for Search (SHARED) ---
	let searchTerm: string = "";
	let highlightedConstituency: string | null = null;
	let searchInput: HTMLInputElement; // For binding

	// --- Component References ---
	// Use bind:this to get references to the component instances
	let mapComponent: ConstituencyCompareMap;
	let scatterComponent: ConstituencyScatter;

	// --- Select constituency ---
	function selectConstituency(constituency: ConstituencyData | null) {
		if (!constituency) {
			resetView();
			return;
		}
		const name = constituency.constituency_name;
		highlightedConstituency = name; // Update highlight state

		// Trigger zoom on map if the map component instance exists and a name is provided
		// This will work even if the map tab is not currently active
		if (mapComponent && name) {
			console.log(`Page: Requesting map zoom to ${name}`);
			mapComponent.zoomToConstituency(name);
		} else {
			console.log(
				"Page: Map component not ready for zoom or no name provided."
			);
		}
	}

	function resetView() {
		highlightedConstituency = null;
		searchTerm = "";
		// Optionally reset map zoom here if desired
		// if (mapComponent) mapComponent.resetZoom(); // Needs a resetZoom method in map component
	}

	// Handle clicks coming UP from the scatter plot OR map
	function handleChildClick(event: CustomEvent<{ name: string }>) {
		const name = event.detail.name;
		console.log(`Page: Received click event for ${name}`);
		const foundConstituency = chartData.find(
			(c) => c.constituency_name === name
		);

		if (foundConstituency) {
			// Toggle highlight: if clicking the already highlighted one, reset. Otherwise, select.
			if (highlightedConstituency === name) {
				resetView();
			} else {
				// This now handles highlight AND attempts map zoom
				selectConstituency(foundConstituency);
			}
		} else {
			console.warn(
				`Constituency "${name}" clicked but not found in main data.`
			);
			resetView();
		}
	}

	// Handle Escape key press globally
	function handleGlobalKeyPress(e: KeyboardEvent) {
		if (e.key === "Escape") {
			// Close search results first if open and input has focus
			if (searchInput && document.activeElement === searchInput) {
				searchInput.blur(); // This should trigger the blur handler to hide results
			} else if (highlightedConstituency) {
				resetView();
			}
		}
	}

	// Add/remove global listener
	onMount(() => {
		// Determine initial loading state based on props passed from server
		isLoadingData = !error && (!chartData || chartData.length === 0);

		if (browser) {
			window.addEventListener("keydown", handleGlobalKeyPress);
			// Handle initial tab based on hash
			const hash = window.location.hash.substring(1);
			if (hash === "compare") {
				activeTab = "compare";
			} else {
				activeTab = "scatter"; // Default
			}
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener("keydown", handleGlobalKeyPress);
		}
	});

	// Update hash when tab changes (use replaceState to avoid history pollution)
	$: if (browser && window.location.hash !== `#${activeTab}`) {
		history.replaceState(null, "", `#${activeTab}`);
	}
</script>

<svelte:head>
	<title>British Constituency Explorer</title>
	<meta
		name="description"
		content="Compare 2024 election results and socio-economic data across British constituencies."
	/>
</svelte:head>

<!-- Main page structure -->
<div class="min-h-screen bg-gray-100 font-sans">
	<main class="container mx-auto px-4 py-8 sm:py-12 max-w-7xl">
		<Header />

		<!-- Controls Card -->
		<div
			class="bg-white p-4 sm:p-5 rounded-lg border border-gray-200/75 mb-8 shadow-sm"
		>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
				<!-- First 2 columns for selectors -->
				<div class="md:col-span-2">
					<SelectionControls
						bind:selectedParty
						bind:selectedMetric
						{metrics}
						{parties}
					/>
				</div>

				<!-- Last column for search -->
				<div class="mt-2 md:mt-0">
					<SearchBox
						data={chartData}
						bind:searchTerm
						bind:searchInput
						bind:highlightedConstituency
						on:select={(e) => selectConstituency(e.detail)}
						on:reset={resetView}
					/>
				</div>
			</div>

			<!-- Reset Button/Highlight Badge -->
			<HighlightBadge {highlightedConstituency} on:reset={resetView} />
		</div>

		<!-- Tab Selector -->
		<TabSelector bind:activeTab />

		<!-- Error Display Area -->
		<div class="mb-6 sm:mb-8">
			<ErrorDisplay {error} loading={isLoadingData} />
		</div>

		<!-- Main Content Area -->
		{#if !isLoadingData && !error}
			<!-- Container to manage layout and height of tab panels -->
			<div
				class="tab-content-container relative min-h-[600px] mx-auto max-w-5xl"
			>
				{" "}
				<!-- Scatter Plot Panel -->
				<div
					role="tabpanel"
					id="scatter-panel"
					aria-labelledby="scatter-tab"
					class="tab-panel {activeTab === 'scatter'
						? 'tab-active'
						: 'tab-inactive'}"
				>
					<ConstituencyScatter
						bind:this={scatterComponent}
						data={chartData}
						{selectedParty}
						{selectedMetric}
						{highlightedConstituency}
						{metrics}
						{parties}
						{partyColors}
						title=""
						compact={false}
						on:constituencyClick={handleChildClick}
					/>
				</div>

				<!-- Map Component Panel -->
				<div
					role="tabpanel"
					id="compare-panel"
					aria-labelledby="compare-tab"
					class="tab-panel max-w-5xl mx-auto {activeTab === 'compare'
						? 'tab-active'
						: 'tab-inactive'}"
				>
					<ConstituencyCompareMap
						bind:this={mapComponent}
						data={chartData}
						{selectedParty}
						{selectedMetric}
						{highlightedConstituency}
						{metrics}
						{parties}
						{partyColors}
						on:constituencyClick={handleChildClick}
					/>
				</div>
			</div>
		{/if}

		<!-- Footer -->
		<Footer />
	</main>
</div>

<!-- Page specific styles -->
<style>
	/* Minimal global styles */
	:global(body) {
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		color: #374151; /* gray-700 */
		background-color: #f9fafb; /* gray-50 */
	}

	/* Subtle focus ring for accessibility */
	:global(
			select:focus-visible,
			input:focus-visible,
			button:focus-visible,
			[role="tab"]:focus-visible
		) {
		outline: 2px solid transparent;
		outline-offset: 2px;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.4); /* Tailwind blue-500 focus ring */
	}

	/* Tab Panel Styling */
	.tab-panel {
		/* Use absolute positioning to stack panels */
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		/* Smooth transition for opacity */
		transition:
			opacity 0.3s ease-in-out,
			visibility 0.3s linear; /* Ensure visibility changes with opacity */
	}

	.tab-inactive {
		opacity: 0;
		pointer-events: none; /* Disable interaction */
		z-index: 0; /* Send to back */
		visibility: hidden; /* Hide completely */
	}

	.tab-active {
		opacity: 1;
		pointer-events: auto; /* Enable interaction */
		z-index: 10; /* Bring to front */
		visibility: visible; /* Make visible */
	}

	/* Container needs relative positioning and min-height */
	.tab-content-container {
		position: relative;
		/* Set a min-height large enough to contain the tallest panel,
		   or adjust dynamically if needed */
		min-height: 600px; /* Example height, adjust based on content */
	}
</style>
