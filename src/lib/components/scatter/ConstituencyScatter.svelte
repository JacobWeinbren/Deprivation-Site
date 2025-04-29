<script lang="ts">
	// Import types and base utils
	import type { ConstituencyData, MetricOption, PartyOption } from "./types";
	import { getNumericValue, debounce } from "./utils";

	// Import Chart specific utils, setup, logic
	import { getResponsiveFontSizes } from "./ChartUtils";
	import { loadChartLibraries } from "./chartSetup";
	import {
		processChartData,
		generateChartConfig,
		applyChartHighlight,
	} from "./chartLogic";
	import type { ProcessedChartData } from "./chartLogic";

	// Import UI components
	import ChartStatistics from "./ChartStatistics.svelte";
	import ChartPlaceholder from "./ChartPlaceholder.svelte";
	import ChartNotes from "./ChartNotes.svelte";

	// Import Chart.js type for instance
	import type { Chart as ChartJSChart, FontSpec } from "chart.js";

	import { onMount, onDestroy, createEventDispatcher } from "svelte";

	// --- Props ---
	export let data: ConstituencyData[] = [];
	export let selectedParty: string = "lab_voteshare";
	export let selectedMetric: string = "overall_local_score";
	export let highlightedConstituency: string | null = null;
	export let title: string = "";
	export let compact: boolean = false;
	export let id: string = Math.random().toString(36).substring(2, 9);
	import {
		metrics as allMetrics,
		parties as allParties,
		partyColors,
	} from "./chartConfig";
	export let metrics: MetricOption[] = allMetrics;
	export let parties: PartyOption[] = allParties;

	// --- State ---
	let chartContainer: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let isLoading: boolean = true;
	let errorMessage: string | null = null;
	let isMounted: boolean = false;
	let chart: ChartJSChart<"scatter"> | null = null;
	let ss: typeof import("simple-statistics") | null = null;
	let ChartJS: typeof ChartJSChart | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let currentProcessedData: ProcessedChartData | null = null;

	// Keep track of previous prop values
	let prevSelectedParty = selectedParty;
	let prevSelectedMetric = selectedMetric;
	let prevDataLength = data?.length ?? 0;
	let prevHighlight = highlightedConstituency;

	const dispatch = createEventDispatcher<{
		constituencyClick: { name: string };
	}>();

	// --- Core Logic ---
	function dispatchConstituencyClick(name: string) {
		dispatch("constituencyClick", { name: name });
	}

	async function updateChart() {
		// Ensure essential elements/libs are ready
		if (!isMounted || !canvas || !chartContainer || !ChartJS || !ss) {
			console.warn(
				"Scatter: updateChart called before mount or library load."
			);
			// Don't change isLoading here, wait for mount/load
			return;
		}
		// Validate input data
		if (!Array.isArray(data)) {
			errorMessage = "Chart Error: Invalid data received.";
			isLoading = false; // Stop loading on validation error
			if (chart) {
				chart.destroy();
				chart = null;
			}
			return;
		}

		// Reset state for update attempt
		errorMessage = null;
		isLoading = true;
		currentProcessedData = null;

		// Use requestAnimationFrame to ensure DOM is ready for width check
		await new Promise((resolve) => requestAnimationFrame(resolve));

		try {
			const containerWidth = chartContainer.clientWidth;
			// Check width *after* potential DOM update
			if (containerWidth <= 0 && isMounted) {
				errorMessage = "Chart container not ready (zero width).";
				// *** Ensure isLoading is set false on early exit ***
				isLoading = false;
				return;
			}

			// 1. Process Data
			console.log(
				`Scatter: Processing data for ${selectedMetric} vs ${selectedParty}`
			);
			const processed = processChartData(
				data,
				selectedMetric,
				selectedParty,
				ss
			);
			currentProcessedData = processed;

			// 2. Check if points were generated
			if (!processed || processed.plotPoints.length === 0) {
				console.warn(
					`Scatter: No valid plot points generated for ${selectedMetric} vs ${selectedParty}.`
				);
				errorMessage = `No valid data points found for the selected combination.`;
				// *** Ensure isLoading is set false on early exit ***
				isLoading = false;
				if (chart) {
					chart.destroy();
					chart = null;
				} // Destroy existing chart
				return;
			}

			// 3. Generate Config
			const config = generateChartConfig(
				processed,
				{
					selectedParty,
					selectedMetric,
					metrics,
					parties,
					partyColors,
					title,
					compact,
					containerWidth,
				},
				dispatchConstituencyClick
			);

			// 4. Update or Create Chart
			if (chart) {
				console.log("Scatter: Updating existing chart instance.");
				chart.data.datasets = config.data.datasets;
				chart.options = config.options;
				if (chart.data.datasets[0]) {
					applyChartHighlight(
						chart.data.datasets[0],
						processed.plotPoints,
						highlightedConstituency,
						compact
					);
				}
				chart.update("none"); // NO ANIMATION
			} else {
				console.log("Scatter: Creating new chart instance.");
				const ctx = canvas.getContext("2d");
				if (!ctx) throw new Error("Could not get canvas context.");
				if (config.data.datasets[0]) {
					applyChartHighlight(
						config.data.datasets[0],
						processed.plotPoints,
						highlightedConstituency,
						compact
					);
				}
				chart = new ChartJS(ctx, config);
			}

			// *** Set isLoading false on successful completion ***
			isLoading = false;
			console.log("Scatter: Chart update complete.");
		} catch (e: any) {
			console.error("Scatter: Chart update error:", e);
			errorMessage = `Chart Error: ${e.message || "Unknown error during update"}`;
			// *** Ensure isLoading is set false in catch block ***
			isLoading = false;
			currentProcessedData = null;
			if (chart) {
				chart.destroy();
				chart = null;
			}
		}
	}

	// --- Highlight Update (Optimized) ---
	function updateHighlightOnly() {
		if (!chart || !chart.options || !currentProcessedData) {
			return;
		}
		const dataset = chart.data.datasets[0];
		if (!dataset) return;
		applyChartHighlight(
			dataset,
			currentProcessedData.plotPoints,
			highlightedConstituency,
			compact
		);
		chart.update("none"); // NO ANIMATION
	}

	// --- Resize handler ---
	const handleResize = debounce(() => {
		if (
			!isMounted ||
			!chart ||
			!chart.options ||
			!chart.options.plugins?.tooltip ||
			!chart.options.scales?.x?.ticks?.font ||
			!chart.options.scales?.y?.ticks?.font ||
			!chart.options.plugins?.title?.font ||
			!chart.options.scales?.x?.title?.font ||
			!chart.options.scales?.y?.title?.font ||
			!chart.options.plugins?.tooltip?.titleFont ||
			!chart.options.plugins?.tooltip?.bodyFont ||
			!chartContainer
		) {
			return;
		}
		const newWidth = chartContainer.clientWidth;
		if (newWidth <= 0) {
			return;
		}
		const newFontSizes = getResponsiveFontSizes(newWidth);
		let optionsChanged = false;
		const updateFontSize = (
			fontObject: Partial<FontSpec> | undefined,
			newSize: number
		): boolean => {
			if (fontObject) {
				if (
					typeof fontObject.size !== "number" ||
					fontObject.size !== newSize
				) {
					fontObject.size = newSize;
					return true;
				}
			}
			return false;
		};
		optionsChanged =
			updateFontSize(
				chart.options.plugins.tooltip.titleFont,
				newFontSizes.tooltipTitleSize
			) || optionsChanged;
		optionsChanged =
			updateFontSize(
				chart.options.plugins.tooltip.bodyFont,
				newFontSizes.tooltipBodySize
			) || optionsChanged;
		optionsChanged =
			updateFontSize(
				chart.options.plugins.title.font,
				newFontSizes.titleSize
			) || optionsChanged;
		optionsChanged =
			updateFontSize(
				chart.options.scales.x.title.font,
				newFontSizes.axisTitleSize
			) || optionsChanged;
		optionsChanged =
			updateFontSize(
				chart.options.scales.y.title.font,
				newFontSizes.axisTitleSize
			) || optionsChanged;
		optionsChanged =
			updateFontSize(
				chart.options.scales.x.ticks.font,
				newFontSizes.tickSize
			) || optionsChanged;
		optionsChanged =
			updateFontSize(
				chart.options.scales.y.ticks.font,
				newFontSizes.tickSize
			) || optionsChanged;
		if (optionsChanged) {
			chart.update("none");
		} // NO ANIMATION
	}, 150);

	// --- Lifecycle ---
	onMount(async () => {
		isMounted = true;
		isLoading = true;
		errorMessage = null;
		try {
			const libs = await loadChartLibraries();
			if (!libs) throw new Error("Chart libraries failed to load.");
			ChartJS = libs.Chart;
			ss = libs.ss;
			// Wait briefly for container to potentially render before first update
			await new Promise((resolve) => setTimeout(resolve, 10));
			await updateChart(); // Initial render attempt
			resizeObserver = new ResizeObserver(handleResize);
			if (chartContainer) resizeObserver.observe(chartContainer);
		} catch (err: any) {
			console.error("Scatter: Initialization failed:", err);
			errorMessage = `Initialization Error: ${err.message}.`;
			isLoading = false; // Ensure loading stops on init error
			isMounted = false;
		}
	});

	onDestroy(() => {
		isMounted = false;
		if (resizeObserver && chartContainer)
			resizeObserver.unobserve(chartContainer);
		resizeObserver = null;
		if (chart) {
			chart.destroy();
			chart = null;
		}
		currentProcessedData = null;
		ChartJS = null;
		ss = null;
		console.log("Scatter: Destroyed.");
	});

	// --- Reactive updates ---
	const debouncedUpdateChart = debounce(updateChart, 200);
	$: if (isMounted && ChartJS && ss) {
		if (
			selectedParty !== prevSelectedParty ||
			selectedMetric !== prevSelectedMetric ||
			data?.length !== prevDataLength
		) {
			console.log(
				"Scatter: Data/Metric/Party changed, triggering full update."
			);
			debouncedUpdateChart();
			prevSelectedParty = selectedParty;
			prevSelectedMetric = selectedMetric;
			prevDataLength = data?.length ?? 0;
		}
	}
	$: if (isMounted && chart && highlightedConstituency !== prevHighlight) {
		console.log("Scatter: Highlight changed, applying style update.");
		updateHighlightOnly();
		prevHighlight = highlightedConstituency;
	}
</script>

<!-- HTML Template -->
<div
	class="font-sans bg-white rounded-lg border border-gray-200/75 shadow-sm {compact
		? 'p-2'
		: 'p-3 sm:p-4'}"
>
	<div
		bind:this={chartContainer}
		class="relative w-full mx-auto bg-gray-50/50 rounded-md border border-gray-200/80 overflow-hidden mb-3"
		style:min-height={compact ? "280px" : "350px"}
		style:aspect-ratio={compact ? "1 / 1" : "16 / 10"}
		style:max-height={compact ? "350px" : "500px"}
	>
		<canvas
			bind:this={canvas}
			class="absolute inset-0 w-full h-full {isLoading || errorMessage
				? 'opacity-0 pointer-events-none'
				: 'opacity-100'} transition-opacity duration-200"
			style="display: block;"
		></canvas>
		{#if isLoading || errorMessage}
			<ChartPlaceholder
				{isLoading}
				{errorMessage}
				initialLoad={!isMounted && isLoading}
			/>
		{/if}
	</div>
	<div
		class="py-1.5 text-center min-h-[28px] bg-gray-100/70 rounded border border-gray-200/60 mb-3"
	>
		<ChartStatistics
			pearsonR={currentProcessedData?.pearsonR ?? null}
			rSquared={currentProcessedData?.rSquared ?? null}
			n={currentProcessedData?.n ?? 0}
			{isLoading}
		/>
	</div>
	<ChartNotes {compact} />
</div>
