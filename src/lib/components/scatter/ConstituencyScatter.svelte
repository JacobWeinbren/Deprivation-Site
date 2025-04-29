<script lang="ts">
	// ... (imports and other script content remain the same) ...
	import { onMount, onDestroy, createEventDispatcher } from "svelte";
	import { browser } from "$app/environment";
	import type {
		ConstituencyData,
		MetricOption,
		PartyOption,
		ChartJSChart,
		SimpleStatistics,
	} from "$lib/types";
	import { debounce } from "$lib/utils";
	import { getResponsiveFontSizes } from "./ChartUtils";
	import { loadChartLibraries } from "./chartSetup";
	import {
		processChartData,
		generateChartConfig,
		applyChartHighlight,
	} from "./chartLogic";
	import type { ProcessedChartData } from "./chartLogic";
	import ChartStatistics from "./ChartStatistics.svelte";
	import ChartPlaceholder from "./ChartPlaceholder.svelte";

	// --- Props ---
	export let data: ConstituencyData[] = [];
	export let selectedParty: string = "lab_voteshare";
	export let selectedMetric: string = "overall_local_score";
	export let highlightedConstituency: string | null = null;
	export let metrics: MetricOption[] = [];
	export let parties: PartyOption[] = [];
	export let compact: boolean = false;

	// --- State ---
	let chartContainer: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let isLoading: boolean = true;
	let errorMessage: string | null = null;
	let isMounted: boolean = false;
	let chart: ChartJSChart<"scatter"> | null = null;
	let ss: SimpleStatistics | null = null;
	let ChartJS: typeof ChartJSChart | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let currentProcessedData: ProcessedChartData | null = null;
	let prevSelectedParty = selectedParty;
	let prevSelectedMetric = selectedMetric;
	let prevData: ConstituencyData[] | null = null;
	let prevHighlight = highlightedConstituency;

	const dispatch = createEventDispatcher<{
		constituencyClick: { name: string };
	}>();
	const logPrefix = "[Scatter]";

	// --- Core Logic (dispatchConstituencyClick, updateChart, updateHighlightOnly, handleResize) ---
	// ... (Functions remain the same as previous version with logging) ...
	function dispatchConstituencyClick(name: string) {
		console.log(
			`${logPrefix} Point clicked, dispatching event for: ${name}`
		);
		dispatch("constituencyClick", { name: name });
	}

	async function updateChart(reason: string = "unknown") {
		console.log(
			`${logPrefix} updateChart called (reason: ${reason}). Current state: isLoading=${isLoading}, isMounted=${isMounted}, hasChart=${!!chart}, dataIsArray=${Array.isArray(
				data
			)}`
		);
		if (!isMounted || !canvas || !chartContainer || !ChartJS || !ss) {
			console.warn(
				`${logPrefix} updateChart prerequisites not met (mount/libs). Bailing out.`
			);
			return;
		}
		if (!Array.isArray(data)) {
			console.error(
				`${logPrefix} updateChart called with non-array data. This shouldn't happen if reactive block logic is correct.`
			);
			errorMessage = "Chart Error: Invalid data state.";
			isLoading = false;
			if (chart) {
				chart.destroy();
				chart = null;
			}
			return;
		}
		if (!isLoading) {
			console.log(`${logPrefix} Setting isLoading = true for update.`);
			errorMessage = null;
			isLoading = true;
		}
		currentProcessedData = null;
		await new Promise((resolve) => requestAnimationFrame(resolve));
		try {
			const containerWidth = chartContainer?.clientWidth ?? 0;
			if (containerWidth <= 0 && isMounted) {
				console.warn(
					`${logPrefix} Chart container not ready (zero width). Retrying...`
				);
				setTimeout(() => updateChart("retry zero width"), 100);
				return;
			}
			console.log(
				`${logPrefix} Processing data for ${selectedMetric} vs ${selectedParty}`
			);
			const processed = processChartData(
				data,
				selectedMetric,
				selectedParty,
				ss
			);
			currentProcessedData = processed;
			console.log(
				`${logPrefix} Data processed. Plot points: ${processed?.plotPoints?.length}, Stat points: ${processed?.statPoints?.length}`
			);
			if (!processed || processed.plotPoints.length === 0) {
				console.warn(
					`${logPrefix} No valid plot points generated for ${selectedMetric} vs ${selectedParty}.`
				);
				errorMessage = `No valid data points found for the selected combination.`;
				isLoading = false;
				if (chart) {
					console.log(
						`${logPrefix} Destroying existing chart as no points were generated.`
					);
					chart.destroy();
					chart = null;
				}
				return;
			}
			console.log(`${logPrefix} Generating chart config...`);
			const config = generateChartConfig(
				processed,
				{
					selectedParty,
					selectedMetric,
					metrics,
					parties,
					compact,
					containerWidth,
				},
				dispatchConstituencyClick
			);
			if (chart) {
				console.log(`${logPrefix} Updating existing chart instance.`);
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
				chart.update("none");
			} else {
				console.log(`${logPrefix} Creating new chart instance.`);
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
			console.log(
				`${logPrefix} Chart update complete. Setting isLoading = false.`
			);
			isLoading = false;
			errorMessage = null;
		} catch (e: any) {
			console.error(`${logPrefix} Chart update error:`, e);
			errorMessage = `Chart Error: ${e.message || "Unknown error during update"}`;
			isLoading = false;
			currentProcessedData = null;
			if (chart) {
				console.log(
					`${logPrefix} Destroying existing chart due to update error.`
				);
				chart.destroy();
				chart = null;
			}
		}
	}

	function updateHighlightOnly() {
		console.log(
			`${logPrefix} updateHighlightOnly called. Highlight: ${highlightedConstituency}`
		);
		if (
			!chart ||
			!chart.options ||
			!currentProcessedData ||
			!currentProcessedData.plotPoints ||
			currentProcessedData.plotPoints.length === 0 ||
			!Array.isArray(data)
		) {
			console.warn(
				`${logPrefix} updateHighlightOnly prerequisites not met. Bailing out.`
			);
			return;
		}
		const dataset = chart.data.datasets[0];
		if (!dataset) {
			console.warn(
				`${logPrefix} updateHighlightOnly: Dataset not found.`
			);
			return;
		}
		applyChartHighlight(
			dataset,
			currentProcessedData.plotPoints,
			highlightedConstituency,
			compact
		);
		chart.update("none");
		console.log(`${logPrefix} Highlight update applied.`);
	}

	const handleResize = debounce(() => {
		if (!isMounted || !chart || !chart.options || !chartContainer) return;
		const newWidth = chartContainer.clientWidth;
		if (newWidth <= 0) return;
		const newFontSizes = getResponsiveFontSizes(newWidth);
		let optionsChanged = false;
		const updateFontSize = (fontObject: any, newSize: number): boolean => {
			if (fontObject && fontObject.size !== newSize) {
				fontObject.size = newSize;
				return true;
			}
			return false;
		};
		if (chart.options?.plugins?.tooltip) {
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
		}
		if (chart.options?.plugins?.title?.font) {
			optionsChanged =
				updateFontSize(
					chart.options.plugins.title.font,
					newFontSizes.titleSize
				) || optionsChanged;
		}
		if (chart.options?.scales?.x?.title?.font) {
			optionsChanged =
				updateFontSize(
					chart.options.scales.x.title.font,
					newFontSizes.axisTitleSize
				) || optionsChanged;
		}
		if (chart.options?.scales?.y?.title?.font) {
			optionsChanged =
				updateFontSize(
					chart.options.scales.y.title.font,
					newFontSizes.axisTitleSize
				) || optionsChanged;
		}
		if (chart.options?.scales?.x?.ticks?.font) {
			optionsChanged =
				updateFontSize(
					chart.options.scales.x.ticks.font,
					newFontSizes.tickSize
				) || optionsChanged;
		}
		if (chart.options?.scales?.y?.ticks?.font) {
			optionsChanged =
				updateFontSize(
					chart.options.scales.y.ticks.font,
					newFontSizes.tickSize
				) || optionsChanged;
		}
		if (optionsChanged) {
			chart.update("none");
		}
	}, 150);

	// --- Lifecycle ---
	onMount(async () => {
		console.log(`${logPrefix} Component mounted.`);
		if (!browser) return;
		isMounted = true;
		isLoading = true; // Start loading
		errorMessage = null;
		try {
			console.log(`${logPrefix} Loading chart libraries...`);
			const libs = await loadChartLibraries();
			if (!libs) throw new Error("Chart libraries failed to load.");
			ChartJS = libs.Chart;
			ss = libs.ss;
			console.log(`${logPrefix} Chart libraries loaded.`);
			console.log(`${logPrefix} Setting up ResizeObserver.`);
			resizeObserver = new ResizeObserver(handleResize);
			if (chartContainer) resizeObserver.observe(chartContainer);
		} catch (err: any) {
			console.error(`${logPrefix} Initialization failed:`, err);
			errorMessage = `Initialization Error: ${err.message}.`;
			isLoading = false;
			isMounted = false;
		}
	});

	onDestroy(() => {
		console.log(`${logPrefix} Component destroying...`);
		isMounted = false;
		if (resizeObserver && chartContainer) {
			console.log(`${logPrefix} Unobserving chart container.`);
			resizeObserver.unobserve(chartContainer);
		}
		resizeObserver = null;
		if (chart) {
			console.log(`${logPrefix} Destroying chart instance.`);
			chart.destroy();
			chart = null;
		}
		currentProcessedData = null;
		ChartJS = null;
		ss = null;
		console.log(`${logPrefix} Cleanup complete.`);
	});

	const debouncedUpdateChart = debounce(updateChart, 100);

	$: if (isMounted && ChartJS && ss) {
		let needsFullUpdate = false;
		let needsHighlightUpdate = false;

		// Check data validity first
		if (!Array.isArray(data)) {
			console.warn(`${logPrefix} Reactive: data is not an array.`);
			if (!isLoading && !errorMessage) {
				errorMessage = "Chart Error: Waiting for valid data...";
			}
			if (chart) {
				console.log(
					`${logPrefix} Reactive: Destroying chart due to invalid data.`
				);
				chart.destroy();
				chart = null;
				currentProcessedData = null;
			}
			prevData = null; // Reset prevData
		} else {
			// Data is valid, check for changes
			if (errorMessage === "Chart Error: Waiting for valid data...") {
				console.log(
					`${logPrefix} Reactive: Valid data received, clearing 'waiting' error.`
				);
				errorMessage = null;
			}

			const isInitialLoad = prevData === null && data.length > 0;
			const dataHasChanged = prevData !== data;
			const partyChanged = selectedParty !== prevSelectedParty;
			const metricChanged = selectedMetric !== prevSelectedMetric;

			if (
				isInitialLoad ||
				partyChanged ||
				metricChanged ||
				dataHasChanged
			) {
				needsFullUpdate = true;
				console.log(
					`${logPrefix} Reactive: Flagging full update. Initial=${isInitialLoad}, Changes: data=${dataHasChanged}, party=${partyChanged}, metric=${metricChanged}`
				);
				prevSelectedParty = selectedParty;
				prevSelectedMetric = selectedMetric;
				prevData = data; // Update prevData reference *after* check
			}

			// Check highlight *separately*
			if (highlightedConstituency !== prevHighlight) {
				// Only flag highlight update if a full update isn't already happening
				if (!needsFullUpdate) {
					needsHighlightUpdate = true;
					console.log(
						`${logPrefix} Reactive: Flagging highlight-only update.`
					);
				} else {
					console.log(
						`${logPrefix} Reactive: Highlight changed, but full update already flagged.`
					);
				}
				// Update prevHighlight regardless of whether only highlight or full update runs
				prevHighlight = highlightedConstituency;
			}

			// Execute updates based on flags
			if (needsFullUpdate) {
				if (!isLoading) isLoading = true;
				debouncedUpdateChart(
					isInitialLoad ? "initial load" : "props change"
				);
			} else if (needsHighlightUpdate) {
				updateHighlightOnly();
			}
		}
	}
</script>

<!-- HTML Template -->
<div class="rounded-lg border border-gray-200/80 bg-white p-3 shadow-sm sm:p-4">
	<div
		bind:this={chartContainer}
		class="relative mx-auto mb-3 h-full w-full overflow-hidden rounded-md border border-gray-200/60 bg-gray-50/50"
		style:min-height={"400px"}
	>
		<canvas
			bind:this={canvas}
			class="absolute inset-0 block h-full w-full {isLoading ||
			errorMessage
				? 'opacity-0 pointer-events-none'
				: 'opacity-100'} transition-opacity duration-200"
			style="box-sizing: border-box;"
		></canvas>
		{#if isLoading || errorMessage}
			<ChartPlaceholder
				{isLoading}
				{errorMessage}
				initialLoad={!chart && isLoading}
			/>
		{/if}
	</div>
	<div
		class="min-h-[28px] rounded border border-gray-200/60 bg-gray-100/70 py-1.5 text-center"
	>
		<ChartStatistics
			pearsonR={currentProcessedData?.pearsonR ?? null}
			rSquared={currentProcessedData?.rSquared ?? null}
			n={currentProcessedData?.n ?? 0}
			{isLoading}
		/>
	</div>
</div>
