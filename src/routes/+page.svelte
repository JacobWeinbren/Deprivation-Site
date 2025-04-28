<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte'; // Import onMount/onDestroy for potential cleanup/listeners
	// Import components
	import ConstituencyScatter from "$lib/components/scatter/ConstituencyScatter.svelte";
	import ConstituencyCompareMap from "$lib/components/scatter/ConstituencyCompareMap.svelte";
	// Import config needed by components and controls
	import { metrics, parties, partyColors, getGroupedMetrics, type ConstituencyData, type MetricOption, type PartyOption } from '$lib/components/scatter/chartConfig'; // Import necessary items
	// Import type for data loaded from the server
	import type { PageData } from "./$types";
	// Import the public environment variable
	import { PUBLIC_MAPBOX_TOKEN } from "$env/static/public";

	// Assign the token to a variable
	const mapboxToken = PUBLIC_MAPBOX_TOKEN;

	// Data loaded from +page.server.ts via the load function
	export let data: PageData;

	// Access properties from the loaded PageData
	const chartData: ConstituencyData[] = data?.chartData ?? []; // Ensure type
	const error = data?.error ?? null;

	// --- State for Active Tab ---
	let activeTab: 'scatter' | 'compare' = 'scatter'; // Default to scatter plot

	// --- State for Selections (SHARED) ---
	let selectedParty = 'lab_voteshare'; // Default party
	let selectedMetric = 'overall_local_score'; // Default metric

	// --- State for Search (SHARED) ---
	let searchTerm: string = "";
	let searchResults: ConstituencyData[] = []; // Store full data objects for results
	let highlightedConstituency: string | null = null; // Store the name of the highlighted one
	let showSearchResults = false; // Control visibility of dropdown

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
				groupOrder.push(group);
			}
			groupMap.get(group)?.push({ value: metric.value, label: metric.label });
		});
		// Keep original order from chartConfig.ts
		orderedGroupedMetrics = groupOrder.map((groupName) => ({
			groupName,
			options: groupMap.get(groupName) || [],
		}));
	}

	// --- Search Logic ---
	$: {
		if (searchTerm.length > 1 && chartData.length > 0) {
			const term = searchTerm.toLowerCase();
			// Search the main chartData array
			searchResults = chartData
				.filter((d) =>
					d.constituency_name?.toLowerCase().includes(term) // Search the correct property
				)
				.slice(0, 5); // Limit results
			showSearchResults = searchResults.length > 0;
		} else {
			searchResults = [];
			// Don't hide immediately if search term is short but results were showing
			if (searchTerm.length <= 1) {
                // Keep showing if it was already showing (allows clicking after deleting)
                // showSearchResults = showSearchResults;
            } else {
                 showSearchResults = false;
            }
		}
	}

	// --- Functions to Handle Search/Highlight ---
	function selectConstituency(constituency: ConstituencyData | null) {
        if (!constituency) {
            resetView(); // If null passed, reset
            return;
        }
		console.log("Page: Selecting:", constituency.constituency_name);
		highlightedConstituency = constituency.constituency_name; // Set the highlighted name
		searchTerm = ""; // Clear search term
		searchResults = []; // Clear results
		showSearchResults = false; // Hide dropdown
	}

	function resetView() {
		console.log("Page: Resetting view");
		highlightedConstituency = null;
		searchTerm = "";
		searchResults = [];
		showSearchResults = false;
	}

	function handleSearchFocus() {
		if (searchTerm.length > 1 && searchResults.length > 0) {
			showSearchResults = true;
		}
	}

	function handleSearchBlur() {
		// Delay hiding results slightly to allow click on result
		setTimeout(() => {
			showSearchResults = false;
		}, 150);
	}

    // Handle clicks coming UP from the scatter plot
    function handleScatterClick(event: CustomEvent<{ name: string }>) {
        const name = event.detail.name;
        const foundConstituency = chartData.find(c => c.constituency_name === name);
        if (foundConstituency) {
            selectConstituency(foundConstituency);
        } else {
            console.warn(`Constituency "${name}" clicked in scatter but not found in main data.`);
            resetView(); // Reset if clicked constituency isn't found (shouldn't happen)
        }
    }

</script>

<svelte:head>
	<title>Constituency Data Explorer</title>
	<meta
		name="description"
		content="Explore and compare voting patterns and deprivation metrics across UK constituencies."
	/>
	<!-- Ensure Mapbox CSS is loaded (can also be in app.html or global CSS) -->
	<link href='https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css' rel='stylesheet' />
	<link href='https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-compare/v0.4.0/mapbox-gl-compare.css' rel='stylesheet' type='text/css' />
</svelte:head>

<main class="container mx-auto p-4">
	<h1 class="text-2xl font-bold text-center mb-6">
		British Constituency Data Explorer
	</h1>

	<!-- Shared Controls & Search -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 max-w-4xl mx-auto items-end">
		<!-- Party Selection -->
		<div class="min-w-[180px]">
			<label for="party-select-page" class="block text-sm font-medium text-gray-700 mb-1"> Party (Y-Axis / Left Map): </label>
			<div class="relative">
				<select id="party-select-page" bind:value={selectedParty} class="block w-full pl-3 pr-8 py-2 text-base bg-white border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out">
					{#each parties as party (party.value)} <option value={party.value}>{party.label}</option> {/each}
				</select>
				<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500"> <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path> </svg> </div>
			</div>
		</div>

		<!-- Metric Selection -->
		<div class="min-w-[180px]">
			<label for="metric-select-page" class="block text-sm font-medium text-gray-700 mb-1"> Metric (X-Axis / Right Map): </label>
			<div class="relative">
				<select id="metric-select-page" bind:value={selectedMetric} class="block w-full pl-3 pr-8 py-2 text-base bg-white border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out">
					{#each orderedGroupedMetrics as groupInfo (groupInfo.groupName)} <optgroup label={groupInfo.groupName}> {#each groupInfo.options as metric (metric.value)} <option value={metric.value}>{metric.label}</option> {/each} </optgroup> {/each}
				</select>
				<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500"> <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path> </svg> </div>
			</div>
		</div>

		<!-- Constituency Search Input -->
        <div class="min-w-[180px] relative">
			<label for="search-input-page" class="block text-sm font-medium text-gray-700 mb-1"> Find Constituency: </label>
			<div class="relative">
				<input
					id="search-input-page"
					type="text"
					placeholder="Type to search..."
					bind:value={searchTerm}
					on:focus={handleSearchFocus}
					on:blur={handleSearchBlur}
					class="block w-full pl-9 pr-3 py-2 text-base bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
					aria-label="Search for a constituency"
					autocomplete="off"
				/>
				<div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
					<svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20"> <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"></path> </svg>
				</div>
			</div>
			<!-- Search Results Dropdown -->
			{#if showSearchResults && searchResults.length > 0}
				<div class="absolute z-20 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-auto py-1" role="listbox">
					{#each searchResults as result (result.const_code)}
						<button role="option" class="block w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-50 focus:outline-none focus:bg-blue-100 transition duration-150 ease-in-out" on:click={() => selectConstituency(result)} on:mousedown|preventDefault>
							{result.constituency_name}
						</button>
					{/each}
				</div>
			{:else if showSearchResults && searchTerm && searchResults.length === 0}
				<div class="absolute z-20 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-500"> No results found. </div>
			{/if}
		</div>
	</div>

	<!-- Reset View Button (appears if highlight is active) -->
	{#if highlightedConstituency}
		<div class="flex justify-center mb-4 -mt-2">
			<button
				on:click={resetView}
				class="flex items-center py-1 px-3 text-xs text-white bg-gray-600 hover:bg-gray-700 rounded-full shadow disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
				aria-label="Clear constituency highlight"
			>
				<span>Highlighting: {highlightedConstituency}</span>
				<svg class="w-3.5 h-3.5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
			</button>
		</div>
	{/if}


	<!-- Tab Navigation -->
	<div class="flex justify-center border-b mb-6">
		<button class="py-2 px-4 font-medium text-sm focus:outline-none {activeTab === 'scatter' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}" on:click={() => activeTab = 'scatter'}> Scatter Plot </button>
		<button class="py-2 px-4 font-medium text-sm focus:outline-none {activeTab === 'compare' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}" on:click={() => activeTab = 'compare'} disabled={!mapboxToken} title={!mapboxToken ? 'Map requires configuration' : 'Show Comparison Map'}> Comparison Map </button>
	</div>


	{#if error}
		<!-- Error Display -->
		<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative max-w-4xl mx-auto" role="alert"> <strong class="font-bold">Error Loading Data:</strong> <span class="block sm:inline">{error}</span> </div>
	{:else if chartData && chartData.length > 0}
		<!-- Conditionally render based on activeTab -->
		<div class="tab-content">
			{#if activeTab === 'scatter'}
				<div class="max-w-4xl mx-auto">
					<ConstituencyScatter
						data={chartData}
						{selectedParty}
						{selectedMetric}
						{highlightedConstituency} 
						mapboxAccessToken={mapboxToken} 
						{metrics}
						{parties} 
						{partyColors}
						title="" 
						compact={false}
						on:constituencyClick={handleScatterClick}
					/>
				</div>
			{:else if activeTab === 'compare'}
				{#if mapboxToken}
					<div class="max-w-5xl mx-auto">
						<ConstituencyCompareMap
							data={chartData}
							{selectedParty}
							{selectedMetric}
							{highlightedConstituency} 
							{metrics}
							{parties}
							{partyColors}
							mapboxAccessToken={mapboxToken}
						/>
					</div>
				{:else}
					<!-- Token Warning -->
					<div class="bg-orange-100 border border-orange-400 text-orange-700 px-4 py-3 rounded relative max-w-4xl mx-auto" role="alert"> <strong class="font-bold">Configuration Warning:</strong> <span class="block sm:inline"> Comparison Map cannot be displayed. Please configure the <code>PUBLIC_MAPBOX_TOKEN</code> environment variable. </span> </div>
				{/if}
			{/if}
		</div>
	{:else if !error}
		<!-- No Data Display -->
		<div class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative max-w-4xl mx-auto" role="alert"> <strong class="font-bold">No Data:</strong> <span class="block sm:inline"> No constituency data could be loaded or the data source is empty. Please check the server or data source. </span> </div>
	{/if}
</main>
