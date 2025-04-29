<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { browser } from "$app/environment";

	// Import components
	import ConstituencyScatter from "$lib/components/scatter/ConstituencyScatter.svelte";
	import ConstituencyCompareMap from "$lib/components/map/ConstituencyCompareMap.svelte";
	import Header from "$lib/components/ui/Header.svelte";
	import SearchBox from "$lib/components/ui/SearchBox.svelte";
	import HighlightBadge from "$lib/components/ui/HighlightBadge.svelte";
	import SelectionControls from "$lib/components/ui/SelectionControls.svelte";
	import TabSelector from "$lib/components/ui/TabSelector.svelte";
	import ErrorDisplay from "$lib/components/ui/ErrorDisplay.svelte";
	import Footer from "$lib/components/ui/Footer.svelte";

	// Import config and types
	import { metrics, partyGroups } from "$lib/config";
	import type { ConstituencyData, PartyOption } from "$lib/types";
	import type { PageData } from "./$types";

	const allPartyOptions: PartyOption[] = partyGroups.flatMap(
		(group) => group.options
	);

	// Data loaded from +page.server.ts
	export let data: PageData; // This prop holds { chartData, error }

	// --- Derived State ---
	// Use reactive declarations ($:) to derive state directly from the 'data' prop
	// This ensures they update correctly when the server data arrives/hydrates.
	$: dataLoadError = data?.error ?? null;
	$: chartData = Array.isArray(data?.chartData) ? data.chartData : []; // Ensure it's always an array
	$: dataIsReady = !dataLoadError && Array.isArray(data?.chartData); // Ready if no error AND chartData is an array
	$: isLoading = !dataIsReady && !dataLoadError; // Loading if not ready and no error yet

	// --- Component State ---
	let activeTab: "scatter" | "compare" = "scatter";
	let selectedParty = "Lab24";
	let selectedMetric = "overall_local_score";
	let searchTerm: string = "";
	let highlightedConstituency: string | null = null;
	let searchInput: HTMLInputElement;

	// --- Component References ---
	let mapComponent: ConstituencyCompareMap;
	let scatterComponent: ConstituencyScatter;

	// --- Event Handlers ---
	function handleConstituencySelect(constituency: ConstituencyData | null) {
		if (!constituency) {
			resetHighlight();
			return;
		}
		const name = constituency.constituency_name;
		highlightedConstituency = name;
	}

	function resetHighlight() {
		highlightedConstituency = null;
		searchTerm = "";
	}

	function handleChildClick(event: CustomEvent<{ name: string }>) {
		const name = event.detail.name;
		const foundConstituency = chartData.find(
			(c) => c.constituency_name === name
		);
		if (foundConstituency) {
			if (highlightedConstituency === name) {
				resetHighlight();
			} else {
				handleConstituencySelect(foundConstituency);
			}
		} else {
			resetHighlight();
		}
	}

	function handleGlobalKeyPress(e: KeyboardEvent) {
		if (e.key === "Escape") {
			if (searchInput && document.activeElement === searchInput) {
				searchInput.blur();
			} else if (highlightedConstituency) {
				resetHighlight();
			}
		}
	}

	// --- Lifecycle ---
	onMount(() => {
		// No need to calculate isLoadingData here anymore, it's reactive ($:)
		if (browser) {
			window.addEventListener("keydown", handleGlobalKeyPress);
			const hash = window.location.hash.substring(1);
			activeTab = hash === "compare" ? "compare" : "scatter";
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener("keydown", handleGlobalKeyPress);
		}
	});

	// Update URL hash when tab changes
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

<!-- *** Adjust main structure for flex grow *** -->
<div class="flex min-h-screen flex-col">
	<main
		class="container mx-auto flex max-w-5xl flex-grow flex-col px-4 py-8 sm:py-12"
	>
		<Header />

		<!-- Controls Card -->
		<div
			class="mb-8 rounded-lg border border-gray-200/80 bg-white p-4 shadow-sm sm:p-5"
		>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
				<div class="md:col-span-2">
					<SelectionControls
						bind:selectedParty
						bind:selectedMetric
						{metrics}
					/>
				</div>
				<div class="mt-2 md:mt-0">
					<SearchBox
						data={dataIsReady ? chartData : []}
						bind:searchTerm
						bind:searchInput
						{highlightedConstituency}
						on:select={(e) => handleConstituencySelect(e.detail)}
					/>
				</div>
			</div>
			<HighlightBadge
				{highlightedConstituency}
				on:reset={resetHighlight}
			/>
		</div>

		<!-- Tab Selector -->
		<TabSelector bind:activeTab />

		<!-- Error/Loading Display Area -->
		<div class="mb-6 sm:mb-8">
			<ErrorDisplay error={dataLoadError} loading={isLoading} />
		</div>

		<!-- Main Content Area -->
		{#if dataIsReady}
			<!-- *** Make this container grow and relative *** -->
			<div class="tab-content-container relative flex-grow">
				<!-- Scatter Plot Panel -->
				<div
					role="tabpanel"
					id="scatter-panel"
					aria-labelledby="scatter-tab"
					class="tab-panel {activeTab === 'scatter'
						? 'tab-active'
						: 'tab-inactive'}"
				>
					<!-- Scatter component will now fill this panel -->
					<ConstituencyScatter
						bind:this={scatterComponent}
						data={chartData}
						{selectedParty}
						{selectedMetric}
						{highlightedConstituency}
						{metrics}
						parties={allPartyOptions}
						on:constituencyClick={handleChildClick}
					/>
				</div>

				<!-- Map Component Panel -->
				<div
					role="tabpanel"
					id="compare-panel"
					aria-labelledby="compare-tab"
					class="tab-panel {activeTab === 'compare'
						? 'tab-active'
						: 'tab-inactive'}"
				>
					<!-- Map component will also fill this panel -->
					<ConstituencyCompareMap
						bind:this={mapComponent}
						data={chartData}
						{selectedParty}
						{selectedMetric}
						{highlightedConstituency}
						{metrics}
						parties={allPartyOptions}
						on:constituencyClick={handleChildClick}
					/>
				</div>
			</div>
		{:else if !isLoading && dataLoadError}
			<div class="mt-8 flex-grow text-center text-gray-600">
				Could not load constituency data. Please try again later.
			</div>
		{/if}

		<!-- Footer (outside the growing container) -->
		<Footer />
	</main>
</div>

<style>
	/* Tab Panel Visibility & Transition */
	.tab-panel {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		transition:
			opacity 0.3s ease-in-out,
			visibility 0.3s linear;
	}
	.tab-inactive {
		opacity: 0;
		pointer-events: none;
		z-index: 0;
		visibility: hidden;
	}
	.tab-active {
		opacity: 1;
		pointer-events: auto;
		z-index: 10;
		visibility: visible;
	}
	/* Container needs relative positioning and min-height */
	.tab-content-container {
		position: relative;
		min-height: 650px; /* Adjust based on content */
	}
</style>
