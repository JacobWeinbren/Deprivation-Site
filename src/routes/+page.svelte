<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { browser } from "$app/environment"; // Import browser check if needed for onMount logic
	// Import components
	import ConstituencyScatter from "$lib/components/scatter/ConstituencyScatter.svelte";
	import ConstituencyCompareMap from "$lib/components/scatter/ConstituencyCompareMap.svelte"; // Corrected path
	// Import config needed by components and controls
	import {
		metrics,
		parties,
		partyColors,
		type ConstituencyData,
		type MetricOption,
		type PartyOption,
	} from "$lib/components/scatter/chartConfig"; // Corrected path
	// Import type for data loaded from the server
	import type { PageData } from "./$types";
	// Import the public environment variable (might hold a key for Maptiler, etc.)
	import { PUBLIC_MAPBOX_TOKEN } from "$env/static/public";

	// Assign the token/key to a variable
	const mapboxToken = PUBLIC_MAPBOX_TOKEN; // Keep name consistent with prop for now

	// Data loaded from +page.server.ts via the load function
	export let data: PageData;

	// Access properties from the loaded PageData
	const chartData: ConstituencyData[] = data?.chartData ?? [];
	const error = data?.error ?? null;

	// --- State for Active Tab ---
	let activeTab: "scatter" | "compare" = "scatter";

	// --- State for Selections (SHARED) ---
	let selectedParty = "lab_voteshare";
	let selectedMetric = "overall_local_score";

	// --- State for Search (SHARED) ---
	let searchTerm: string = "";
	let searchResults: ConstituencyData[] = [];
	let highlightedConstituency: string | null = null;
	let showSearchResults = false;
	let searchInput: HTMLInputElement; // For binding

	// --- Component References ---
	let mapComponent: ConstituencyCompareMap; // Reference to the map component instance

	// --- Prepare grouped metrics for dropdown ---
	let orderedGroupedMetrics: {
		groupName: string;
		options: { value: string; label: string }[];
	}[] = [];
	$: {
		const groupMap = new Map<string, { value: string; label: string }[]>();
		const groupOrder: string[] = [];
		metrics.forEach((metric) => {
			const group = metric.group || "Other";
			if (!groupMap.has(group)) {
				groupMap.set(group, []);
				if (!groupOrder.includes(group)) {
					// Ensure unique group order
					groupOrder.push(group);
				}
			}
			groupMap
				.get(group)
				?.push({ value: metric.value, label: metric.label });
		});
		orderedGroupedMetrics = groupOrder.map((groupName) => ({
			groupName,
			options: groupMap.get(groupName) || [],
		}));
	}

	// --- Search Logic ---
	$: {
		if (browser && chartData.length > 0) {
			// Add browser check for safety
			if (searchTerm.length > 1) {
				const term = searchTerm.toLowerCase().trim();
				searchResults = chartData
					.filter((d) =>
						d.constituency_name?.toLowerCase().includes(term)
					)
					.sort(
						(
							a,
							b // Sort results alphabetically
						) =>
							a.constituency_name.localeCompare(
								b.constituency_name
							)
					)
					.slice(0, 7); // Limit results
				showSearchResults = searchResults.length > 0;
			} else {
				searchResults = [];
				showSearchResults = false;
			}
		} else {
			searchResults = [];
			showSearchResults = false;
		}
	}

	// --- Functions to Handle Search/Highlight ---
	function selectConstituency(constituency: ConstituencyData | null) {
		if (!constituency) {
			resetView();
			return;
		}
		const name = constituency.constituency_name;
		// console.log("Page: Selecting:", name);
		highlightedConstituency = name;
		searchTerm = "";
		searchResults = [];
		showSearchResults = false;
		searchInput?.blur(); // Blur input after selection

		// Trigger zoom on map if it exists and a name is provided
		if (mapComponent && name) {
			mapComponent.zoomToConstituency(name);
		}
	}

	function resetView() {
		// console.log("Page: Resetting view");
		highlightedConstituency = null;
		searchTerm = "";
		searchResults = [];
		showSearchResults = false;
		searchInput?.blur(); // Blur input on reset
		// Optionally reset map zoom here if desired
		// if (mapComponent) mapComponent.resetZoom(); // Assuming you add a resetZoom method
	}

	function handleSearchFocus() {
		if (searchTerm.length > 1 && searchResults.length > 0) {
			showSearchResults = true;
		}
	}

	function handleSearchBlur() {
		// Delay hiding results slightly to allow click on result
		setTimeout(() => {
			// Check if the focus moved to a result button before hiding
			if (!document.activeElement?.closest(".search-result-button")) {
				showSearchResults = false;
			}
		}, 150);
	}

	let scatterComponent: ConstituencyScatter | undefined = undefined; // Add reference for scatter if needed

	// Handle clicks coming UP from the scatter plot OR map
	function handleChildClick(event: CustomEvent<{ name: string }>) {
		const name = event.detail.name;
		const foundConstituency = chartData.find(
			(c) => c.constituency_name === name
		);

		if (foundConstituency) {
			// Toggle highlight: if clicking the already highlighted one, reset. Otherwise, select.
			if (highlightedConstituency === name) {
				resetView();
			} else {
				selectConstituency(foundConstituency); // This now handles highlight AND zoom
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
			if (showSearchResults) {
				showSearchResults = false;
				searchInput?.blur();
			} else if (highlightedConstituency) {
				resetView();
			}
		}
	}

	// Add/remove global listener
	onMount(() => {
		if (browser) {
			window.addEventListener("keydown", handleGlobalKeyPress);
			// Handle initial tab based on hash (optional)
			const hash = window.location.hash.substring(1);
			if (hash === "compare") {
				activeTab = "compare";
			} else {
				activeTab = "scatter";
			}
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener("keydown", handleGlobalKeyPress);
		}
	});

	// Update hash when tab changes (optional)
	$: if (browser && window.location.hash !== `#${activeTab}`) {
		window.location.hash = activeTab;
	}
</script>

<svelte:head>
	<title>British Constituency Explorer</title>
	<meta
		name="description"
		content="Compare 2024 election results and socio-economic data across British constituencies."
	/>
	<!-- MapLibre CSS is now handled within the component's styles -->
</svelte:head>

<!-- Main page structure -->
<div class="min-h-screen bg-gray-50 font-sans">
	<main class="container mx-auto px-4 py-8 sm:py-10 max-w-6xl">
		<h1
			class="text-2xl sm:text-3xl font-semibold text-center mb-4 text-gray-800"
		>
			British Constituency Explorer
		</h1>
		<p class="text-center text-sm text-gray-600 mb-8 max-w-2xl mx-auto">
			Compare 2024 General Election results with socio-economic data.
			Select a party and metric below, then explore the scatter plot or
			compare maps. Click a point or area to highlight and zoom.
		</p>

		<!-- Controls Card -->
		<div class="bg-white p-4 rounded-lg border border-gray-200/75 mb-8">
			<div
				class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end text-sm"
			>
				<!-- Party Selection -->
				<div>
					<label
						for="party-select-page"
						class="block text-xs font-medium text-gray-600 mb-1"
					>
						Party / Left Map
					</label>
					<div class="relative">
						<select
							id="party-select-page"
							bind:value={selectedParty}
							class="block w-full pl-3 pr-8 py-1.5 text-sm bg-white border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out hover:border-gray-400"
						>
							{#each parties as party (party.value)}
								<option value={party.value}
									>{party.label}</option
								>
							{/each}
						</select>
						<div
							class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400"
						>
							<svg
								class="w-4 h-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 9l4-4 4 4m0 6l-4 4-4-4"
								></path>
							</svg>
						</div>
					</div>
				</div>

				<!-- Metric Selection -->
				<div>
					<label
						for="metric-select-page"
						class="block text-xs font-medium text-gray-600 mb-1"
					>
						Metric / Right Map
					</label>
					<div class="relative">
						<select
							id="metric-select-page"
							bind:value={selectedMetric}
							class="block w-full pl-3 pr-8 py-1.5 text-sm bg-white border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out hover:border-gray-400"
						>
							{#each orderedGroupedMetrics as groupInfo (groupInfo.groupName)}
								<optgroup label={groupInfo.groupName}>
									{#each groupInfo.options as metric (metric.value)}
										<option value={metric.value}
											>{metric.label}</option
										>
									{/each}
								</optgroup>
							{/each}
						</select>
						<div
							class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400"
						>
							<svg
								class="w-4 h-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 9l4-4 4 4m0 6l-4 4-4-4"
								></path>
							</svg>
						</div>
					</div>
				</div>

				<!-- Constituency Search -->
				<div class="relative">
					<label
						for="search-input-page"
						class="block text-xs font-medium text-gray-600 mb-1"
					>
						Find & Highlight
					</label>
					<div class="relative">
						<div
							class="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none"
						>
							<svg
								class="w-4 h-4 text-gray-400"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									fill-rule="evenodd"
									d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
									clip-rule="evenodd"
								></path>
							</svg>
						</div>
						<input
							bind:this={searchInput}
							id="search-input-page"
							type="text"
							placeholder="Search..."
							bind:value={searchTerm}
							on:focus={handleSearchFocus}
							on:blur={handleSearchBlur}
							class="block w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out hover:border-gray-400"
							aria-label="Search for a constituency"
							autocomplete="off"
							aria-haspopup="listbox"
							aria-expanded={showSearchResults}
						/>
					</div>
					<!-- Search Results -->
					{#if showSearchResults}
						<div
							class="absolute z-20 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-auto py-1 text-sm"
							role="listbox"
							aria-labelledby="search-input-page"
						>
							{#if searchResults.length > 0}
								{#each searchResults as result (result.const_code)}
									<button
										role="option"
										aria-selected="false"
										class="search-result-button block w-full text-left px-3 py-1.5 text-gray-700 hover:bg-blue-50 focus:outline-none focus:bg-blue-100 transition duration-150 ease-in-out"
										on:click={() =>
											selectConstituency(result)}
										on:mousedown|preventDefault
									>
										{result.constituency_name}
									</button>
								{/each}
							{:else if searchTerm}
								<div class="px-3 py-1.5 text-gray-500 italic">
									No results.
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<!-- Reset Button -->
			{#if highlightedConstituency}
				<div
					class="flex justify-center mt-4 pt-3 border-t border-gray-100"
				>
					<button
						on:click={resetView}
						class="flex items-center py-1 px-3 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition duration-150 ease-in-out focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-gray-400"
						aria-label="Clear constituency highlight"
					>
						<span>{highlightedConstituency}</span>
						<svg
							class="w-3 h-3 ml-1.5 text-gray-500"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							></path>
						</svg>
					</button>
				</div>
			{/if}
		</div>

		<!-- Tab Navigation -->
		<div class="flex justify-center mb-6">
			<div
				class="inline-flex bg-gray-100 p-0.5 rounded-md border border-gray-200/75"
			>
				<button
					class="py-1.5 px-4 text-sm font-medium focus:outline-none rounded transition-colors duration-150 ease-in-out {activeTab ===
					'scatter'
						? 'bg-white text-blue-600 shadow-sm'
						: 'text-gray-500 hover:text-gray-700'}"
					on:click={() => (activeTab = "scatter")}
					aria-pressed={activeTab === "scatter"}
				>
					Scatter
				</button>
				<button
					class="py-1.5 px-4 text-sm font-medium focus:outline-none rounded transition-colors duration-150 ease-in-out {activeTab ===
					'compare'
						? 'bg-white text-blue-600 shadow-sm'
						: 'text-gray-500 hover:text-gray-700'}"
					on:click={() => (activeTab = "compare")}
					aria-pressed={activeTab === "compare"}
				>
					Compare Maps
				</button>
			</div>
		</div>

		<!-- Error Display Area -->
		{#if error}
			<div
				class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md max-w-3xl mx-auto text-sm"
				role="alert"
			>
				<strong class="font-medium">Error Loading Data:</strong>
				<span class="block sm:inline ml-1">{error}</span>
			</div>
			<!-- Main Content Area -->
		{:else if chartData && chartData.length > 0}
			<!-- Use CSS to toggle visibility instead of #if -->
			<div class="tab-content relative">
				<!-- Both components always mounted, visibility toggled with opacity and pointer-events -->
				<div
					class="max-w-4xl mx-auto transition-opacity duration-300"
					style="opacity: {activeTab === 'scatter' ? 1 : 0}; 
						   pointer-events: {activeTab === 'scatter' ? 'auto' : 'none'};
						   position: {activeTab === 'scatter' ? 'relative' : 'absolute'};
						   width: 100%;"
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

				<div
					class="max-w-5xl mx-auto transition-opacity duration-300"
					style="opacity: {activeTab === 'compare' ? 1 : 0}; 
						   pointer-events: {activeTab === 'compare' ? 'auto' : 'none'};
						   position: {activeTab === 'compare' ? 'relative' : 'absolute'};
						   width: 100%;"
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
						mapboxAccessToken={mapboxToken}
						on:constituencyClick={handleChildClick}
					/>
				</div>
			</div>
			<!-- Loading/No Data Display -->
		{:else if !error}
			<div
				class="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md max-w-3xl mx-auto text-sm"
				role="status"
			>
				<strong class="font-medium">Loading Data...</strong>
			</div>
		{/if}

		<!-- Footer -->
		<footer class="text-center mt-12 pt-6 border-t border-gray-200">
			<p class="text-xs text-gray-500">
				Data: HoC Library, ONS, HESA, ECPC, gov.scot. Map: MapLibre,
				OpenStreetMap. Boundaries: PCON24.
			</p>
			<p class="text-xs text-gray-500 mt-1">
				Developed by Jacob Weinbren.
			</p>
		</footer>
	</main>
</div>

<!-- Page specific styles -->
<style>
	/* Minimal global styles */
	:global(body) {
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		color: #374151; /* gray-700 */
	}

	/* Style optgroup labels */
	select optgroup {
		font-weight: 500; /* medium */
		font-style: normal;
		color: #4b5563; /* gray-600 */
		background-color: #f9fafb; /* gray-50 */
		padding: 3px 0;
		font-size: 0.8rem;
	}

	/* Style options within optgroups */
	select optgroup option {
		font-weight: normal;
		background-color: #ffffff;
		color: #1f2937; /* gray-800 */
		padding: 2px 10px;
	}

	/* Subtle focus ring */
	:global(select:focus-visible, input:focus-visible, button:focus-visible) {
		outline: 2px solid transparent;
		outline-offset: 2px;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3); /* Lighter blue focus ring */
	}

	/* Ensure hidden tabs don't affect layout when not active */
	.tab-content > div.hidden {
		display: none;
	}
	.tab-content > div.block {
		display: block;
	}
</style>
