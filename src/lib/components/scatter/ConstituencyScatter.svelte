<!-- src/lib/components/scatter/ConstituencyScatter.svelte -->

<!-- Ambient module declaration MUST be at the top level -->
<script lang="ts">
	// Type definitions for Chart.js and its plugins
	declare global {
		interface Window {
			Chart: ChartType;
		}
	}
	interface ChartType {
		new (ctx: CanvasRenderingContext2D, config: any): ChartInstance;
		register(...items: any[]): void;
	}
	interface ChartInstance {
		destroy(): void;
		update(mode?: "none" | "resize" | "reset" | "active"): void;
		resize(): void;
		data: any;
		options: any;
	}
	interface ResponsiveFontSizes {
		titleSize: number;
		axisTitleSize: number;
		tickSize: number;
		annotationSize: number;
		tooltipTitleSize: number;
		tooltipBodySize: number;
	}

	// Use only core Svelte imports
	import { onMount, onDestroy, createEventDispatcher } from "svelte";
	import {
		type ConstituencyData,
		type MetricOption,
		type PartyOption,
	} from "./chartConfig";
	import { getNumericValue, debounce } from "./utils";

	// --- Props ---
	export let data: ConstituencyData[] = [];
	export let selectedParty: string = "lab_voteshare";
	export let selectedMetric: string = "overall_local_score";
	export let highlightedConstituency: string | null = null;
	export let title: string = "";
	export let compact: boolean = false;
	export let id: string = Math.random().toString(36).substring(2, 9);
	export let metrics: MetricOption[] = [];
	export let parties: PartyOption[] = [];
	export let partyColors: { [key: string]: string } = {};

	// --- State ---
	let chartContainer: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let placeholderElement: HTMLDivElement;
	let statsElement: HTMLDivElement;
	let isLoading: boolean = true;
	let errorMessage: string | null = null;
	let statsText: string = "";
	let isMounted: boolean = false;
	let chart: ChartInstance | null = null;
	let ss: any = null;
	let resizeObserver: ResizeObserver | null = null;
	// Search/Highlight state moved to parent
	let currentPlotPoints: {
		x: number;
		y: number;
		label: string;
		id: string;
	}[] = [];
	let currentTooltipLabels: string[] = [];

	// Keep track of previous prop values to detect actual changes
	let prevSelectedParty = selectedParty;
	let prevSelectedMetric = selectedMetric;
	let prevDataLength = data?.length ?? 0;
	let prevHighlight = highlightedConstituency; // Track previous highlight

	const dispatch = createEventDispatcher<{
		constituencyClick: { name: string };
	}>(); // Type the dispatch event

	// --- Responsive Settings ---
	const smallBreakpoint = 640; // px width threshold for smaller text

	// --- Helper Function to Calculate Font Sizes ---
	function getResponsiveFontSizes(width: number): ResponsiveFontSizes {
		const isSmall = width < smallBreakpoint;
		return {
			titleSize: isSmall ? 14 : 16,
			axisTitleSize: isSmall ? 11 : 13,
			tickSize: isSmall ? 9 : 11,
			annotationSize: isSmall ? 9 : 11, // Keep consistent
			tooltipTitleSize: isSmall ? 11 : 13,
			tooltipBodySize: isSmall ? 10 : 12,
		};
	}

	// --- Apply highlight styles without full redraw ---
	function applyHighlight() {
		if (
			!chart ||
			!chart.data.datasets ||
			!chart.data.datasets[0] ||
			!currentPlotPoints ||
			currentPlotPoints.length === 0
		)
			return;
		const dataset = chart.data.datasets[0];
		const defaultPointSize = 3;
		const highlightedPointSize = 6;
		// Use the prop directly
		dataset.pointRadius = currentPlotPoints.map((p) =>
			p.label === highlightedConstituency
				? highlightedPointSize
				: defaultPointSize
		);
		dataset.borderColor = currentPlotPoints.map((p) =>
			p.label === highlightedConstituency ? "#000000" : "transparent"
		);
		dataset.borderWidth = currentPlotPoints.map((p) =>
			p.label === highlightedConstituency ? 1.5 : 0
		);
		// Avoid calling update if the chart is currently animating or updating
		try {
			chart.update("none");
		} catch (e) {
			console.error("Error updating chart highlight:", e);
		}
	}

	// --- Select constituency and DISPATCH event ---
	function dispatchConstituencyClick(name: string) {
		console.log("Scatter: Dispatching click for", name);
		dispatch("constituencyClick", { name: name }); // Notify parent
	}

	// --- Load Chart.js ---
	async function loadChartLibraries() {
		if (!window.Chart) {
			try {
				const [chartModule, trendlineModule, annotationModule] =
					await Promise.all([
						import("chart.js"),
						import("chartjs-plugin-trendline"),
						import("chartjs-plugin-annotation"),
					]);
				const {
					Chart,
					LinearScale,
					PointElement,
					LineElement,
					Tooltip,
					Legend,
					Title: ChartTitle,
					ScatterController,
					LineController,
				} = chartModule;
				Chart.register(
					LinearScale,
					PointElement,
					LineElement,
					Tooltip,
					Legend,
					ChartTitle,
					ScatterController,
					LineController,
					trendlineModule.default,
					annotationModule.default
				);
				window.Chart = Chart;
			} catch (e) {
				console.error("Failed to load Chart.js or plugins:", e);
				throw new Error("Failed to load chart library.");
			}
		}
	}

	// --- Main chart update function ---
	function updateChart() {
		// Use props selectedParty and selectedMetric directly
		// console.log(`Scatter: Updating chart for Party=${selectedParty}, Metric=${selectedMetric}`);

		if (
			!isMounted ||
			!canvas ||
			!placeholderElement ||
			!statsElement ||
			!ss ||
			!chartContainer
		) {
			isLoading = false;
			return;
		}

		// Don't set isLoading=true here for every minor update, only for initial load
		errorMessage = null; // Clear previous errors on update attempt
		statsText = "";

		// Show loading only if chart doesn't exist yet (initial load)
		if (!chart) {
			isLoading = true;
			placeholderElement.innerHTML = `<div class="flex flex-col items-center justify-center text-center"><div class="animate-pulse flex space-x-2 mb-2"><div class="h-2 w-2 bg-gray-400 rounded-full"></div><div class="h-2 w-2 bg-gray-400 rounded-full"></div><div class="h-2 w-2 bg-gray-400 rounded-full"></div></div><p class="text-gray-600 text-sm">Analyzing data...</p></div>`;
			canvas.style.display = "none";
			placeholderElement.style.display = "flex";
		}

		try {
			// Libraries loaded in onMount

			const containerWidth = chartContainer.clientWidth;
			const fontSizes = getResponsiveFontSizes(containerWidth);

			const currentParty = selectedParty;
			const currentMetric = selectedMetric;
			const selectedPartyLabel =
				parties.find((p) => p.value === currentParty)?.label ||
				currentParty;
			const selectedMetricLabel =
				metrics.find((m) => m.value === currentMetric)?.label ||
				currentMetric;
			const color = partyColors[currentParty] || "#6B7280";

			// Prepare data points
			const plotPoints: {
				x: number;
				y: number;
				label: string;
				id: string;
			}[] = [];
			const statPoints: [number, number][] = [];
			for (const row of data) {
				const xVal = getNumericValue(row, currentMetric);
				const yVal = getNumericValue(row, currentParty);
				const name = row.constituency_name;
				const id =
					row.const_code ||
					String(
						row.constituency_id ||
							row.ons_id ||
							`${name}-${xVal}-${yVal}`
					);
				if (
					xVal !== null &&
					yVal !== null &&
					isFinite(xVal) &&
					isFinite(yVal) &&
					xVal > 0 &&
					yVal > 0 &&
					name &&
					id
				) {
					plotPoints.push({ x: xVal, y: yVal, label: name, id });
					statPoints.push([xVal, yVal]);
				}
			}
			currentPlotPoints = [...plotPoints];
			currentTooltipLabels = currentPlotPoints.map((p) => p.label);

			if (statPoints.length < 3) {
				throw new Error(
					"Not enough valid data points (>0) for correlation."
				);
			}

			// Statistical calculations
			let regressionLine: { x: number[]; y: number[] } | null = null;
			let pearsonR: number = NaN;
			let rSquared: number = NaN;
			const n = statPoints.length;
			const xValues = statPoints.map((p) => p[0]);
			const yValues = statPoints.map((p) => p[1]);
			const regression = ss.linearRegression(statPoints);
			const regressionFunction = ss.linearRegressionLine(regression);
			pearsonR = ss.sampleCorrelation(xValues, yValues);
			rSquared = pearsonR * pearsonR;
			const xMin = ss.min(xValues);
			const xMax = ss.max(xValues);
			const numPoints = 50;
			const xStep = (xMax - xMin) / (numPoints - 1);
			const regressionPoints = [];
			for (let i = 0; i < numPoints; i++) {
				const x = xMin + i * xStep;
				let y = regressionFunction(x);
				regressionPoints.push({ x, y });
			}
			regressionLine = {
				x: regressionPoints.map((p) => p.x),
				y: regressionPoints.map((p) => p.y),
			};

			// Configure point appearance using highlightedConstituency prop
			const defaultPointSize = 3;
			const highlightedPointSize = 6;
			const pointSizes = currentPlotPoints.map((p) =>
				p.label === highlightedConstituency
					? highlightedPointSize
					: defaultPointSize
			);
			const pointBorderColors = currentPlotPoints.map((p) =>
				p.label === highlightedConstituency ? "#000000" : "transparent"
			);
			const pointBorderWidths = currentPlotPoints.map((p) =>
				p.label === highlightedConstituency ? 1.5 : 0
			);

			// Define chart datasets
			const datasets: any[] = [
				{
					label: "Constituencies",
					data: currentPlotPoints.map((p) => ({ x: p.x, y: p.y })),
					backgroundColor: color,
					borderColor: pointBorderColors,
					borderWidth: pointBorderWidths,
					pointRadius: pointSizes,
					pointHoverRadius: 8,
					pointHitRadius: 6,
					pointHoverBorderWidth: 2,
					pointHoverBackgroundColor: color,
					pointHoverBorderColor: "#000000",
				},
			];
			if (regressionLine) {
				datasets.push({
					type: "line",
					label: "Trend",
					data: regressionLine.x.map((x, i) => ({
						x,
						y: regressionLine.y[i],
					})),
					backgroundColor: "transparent",
					borderColor: "rgba(0, 0, 0, 0.6)",
					borderWidth: 1.5,
					pointRadius: 0,
					fill: false,
					tension: 0.1,
				});
			}

			const chartTitleText =
				title || `${selectedPartyLabel} vs ${selectedMetricLabel}`;

			// If chart exists, update data and options. If not, create it.
			if (chart) {
				// console.log("Scatter: Updating existing chart instance.");
				chart.data.datasets = datasets; // Update datasets
				chart.options.plugins.title.text = chartTitleText;
				chart.options.plugins.title.display =
					!compact && !!chartTitleText;
				chart.options.scales.x.title.text = selectedMetricLabel;
				chart.options.scales.y.title.text = selectedPartyLabel;
				chart.options.plugins.tooltip.callbacks.label = function (
					context: any
				) {
					const index = context.dataIndex;
					const datasetIndex = context.datasetIndex;
					if (datasetIndex === 0 && currentTooltipLabels[index]) {
						const pointLabel = currentTooltipLabels[index];
						const x = context.parsed.x.toLocaleString(undefined, {
							maximumFractionDigits: 2,
						});
						const y = context.parsed.y.toLocaleString(undefined, {
							maximumFractionDigits: 2,
						});
						return [
							pointLabel,
							`${selectedMetricLabel}: ${x}`,
							`${selectedPartyLabel}: ${y}%`,
						]; // Use updated labels
					}
					return null;
				};
				chart.update(); // Perform chart update
			} else {
				// console.log("Scatter: Creating new chart instance.");
				const ctx = canvas.getContext("2d");
				if (!ctx) throw new Error("Could not get canvas context.");
				chart = new window.Chart(ctx, {
					type: "scatter",
					data: { datasets },
					options: {
						responsive: true,
						maintainAspectRatio: true,
						aspectRatio: compact ? 1.2 : 1.6,
						animation: { duration: 400 },
						interaction: {
							mode: "nearest",
							intersect: true,
							axis: "xy",
						},
						plugins: {
							legend: { display: false },
							tooltip: {
								enabled: true,
								backgroundColor: "rgba(0, 0, 0, 0.8)",
								titleColor: "#ffffff",
								bodyColor: "#ffffff",
								borderColor: "rgba(0,0,0,0.1)",
								borderWidth: 1,
								padding: 10,
								displayColors: false,
								titleFont: {
									weight: "bold",
									size: fontSizes.tooltipTitleSize,
								},
								bodyFont: { size: fontSizes.tooltipBodySize },
								callbacks: {
									label: function (context: any) {
										const index = context.dataIndex;
										const datasetIndex =
											context.datasetIndex;
										if (
											datasetIndex === 0 &&
											currentTooltipLabels[index]
										) {
											const pointLabel =
												currentTooltipLabels[index];
											const x =
												context.parsed.x.toLocaleString(
													undefined,
													{ maximumFractionDigits: 2 }
												);
											const y =
												context.parsed.y.toLocaleString(
													undefined,
													{ maximumFractionDigits: 2 }
												);
											return [
												pointLabel,
												`${selectedMetricLabel}: ${x}`,
												`${selectedPartyLabel}: ${y}%`,
											];
										}
										return null;
									},
								},
							},
							title: {
								display: !compact && !!chartTitleText,
								text: chartTitleText,
								padding: { top: 10, bottom: 20 },
								font: {
									size: fontSizes.titleSize,
									weight: "bold",
									family: "'Inter', sans-serif",
								},
								color: "#333333",
							},
						},
						scales: {
							x: {
								type: "linear",
								position: "bottom",
								title: {
									display: true,
									text: selectedMetricLabel,
									font: {
										size: fontSizes.axisTitleSize,
										family: "'Inter', sans-serif",
									},
									color: "#555555",
									padding: { top: 10 },
								},
								grid: { color: "#eeeeee" },
								border: { color: "#dddddd" },
								ticks: {
									color: "#666666",
									font: { size: fontSizes.tickSize },
									callback: function (value: any) {
										const numValue = Number(value);
										if (isNaN(numValue)) return value;
										if (
											currentMetric.includes("price") ||
											currentMetric.includes("income")
										) {
											return numValue >= 1000
												? (numValue / 1000).toFixed(0) +
														"k"
												: numValue.toLocaleString();
										}
										return numValue.toLocaleString(
											undefined,
											{ maximumFractionDigits: 1 }
										);
									},
								},
							},
							y: {
								type: "linear",
								position: "left",
								beginAtZero: true,
								title: {
									display: true,
									text: selectedPartyLabel,
									font: {
										size: fontSizes.axisTitleSize,
										family: "'Inter', sans-serif",
									},
									color: "#555555",
									padding: { bottom: 10 },
								},
								grid: { color: "#eeeeee" },
								border: { color: "#dddddd" },
								ticks: {
									color: "#666666",
									font: { size: fontSizes.tickSize },
									callback: function (value: any) {
										return value + "%";
									},
								},
							},
						},
						onClick: (_event: MouseEvent, elements: any[]) => {
							if (!elements || elements.length === 0) return;
							const element = elements[0];
							if (element.datasetIndex === 0) {
								const index = element.index;
								if (
									index !== undefined &&
									index >= 0 &&
									index < currentTooltipLabels.length
								) {
									dispatchConstituencyClick(
										currentTooltipLabels[index]
									);
								}
							} // Dispatch event
						},
					},
				});
				// Hide placeholder, show canvas after creation
				placeholderElement.style.display = "none";
				canvas.style.display = "block";
				isLoading = false; // Set loading false after initial creation
			}

			// Update stats text area
			statsText = `<div class="text-center text-gray-600 text-sm"><span class="font-medium">Pearson correlation (r):</span> ${pearsonR.toFixed(3)}<span class="mx-2">|</span><span class="font-medium">R²:</span> ${rSquared.toFixed(3)}<span class="mx-2">|</span><span class="font-medium">Constituencies:</span> ${n.toLocaleString()}</div>`;
		} catch (e: any) {
			console.error("Chart update error:", e);
			errorMessage = `Chart Error: ${e.message}`;
			placeholderElement.textContent = errorMessage;
			placeholderElement.style.display = "flex";
			canvas.style.display = "none";
			statsText = "";
			currentPlotPoints = [];
			currentTooltipLabels = [];
			if (chart) {
				chart.destroy();
				chart = null;
			} // Destroy if error occurred during update
			isLoading = false; // Ensure loading is off on error
		}
	}

	// --- Resize handler ---
	const handleResize = debounce(() => {
		if (!chart || !chartContainer || !isMounted) return;
		chart.resize();
		const newWidth = chartContainer.clientWidth;
		const newFontSizes = getResponsiveFontSizes(newWidth);
		if (chart.options?.plugins?.title?.font) {
			chart.options.plugins.title.font.size = newFontSizes.titleSize;
		}
		if (chart.options?.scales?.x?.title?.font) {
			chart.options.scales.x.title.font.size = newFontSizes.axisTitleSize;
		}
		if (chart.options?.scales?.y?.title?.font) {
			chart.options.scales.y.title.font.size = newFontSizes.axisTitleSize;
		}
		if (chart.options?.scales?.x?.ticks?.font) {
			chart.options.scales.x.ticks.font.size = newFontSizes.tickSize;
		}
		if (chart.options?.scales?.y?.ticks?.font) {
			chart.options.scales.y.ticks.font.size = newFontSizes.tickSize;
		}
		if (chart.options?.plugins?.tooltip?.titleFont) {
			chart.options.plugins.tooltip.titleFont.size =
				newFontSizes.tooltipTitleSize;
		}
		if (chart.options?.plugins?.tooltip?.bodyFont) {
			chart.options.plugins.tooltip.bodyFont.size =
				newFontSizes.tooltipBodySize;
		}
		chart.update("none");
	}, 150);

	// --- Lifecycle ---
	onMount(async () => {
		isLoading = true;
		errorMessage = null; // Set loading true initially
		placeholderElement.innerHTML = `... Loading Chart ...`;
		placeholderElement.style.display = "flex";
		canvas.style.display = "none";

		try {
			// Load libraries ONCE
			await loadChartLibraries();
			ss = await import("simple-statistics");
			if (typeof ss?.linearRegression !== "function") {
				throw new Error("Statistics library failed to load correctly.");
			}

			isMounted = true; // Set mounted flag AFTER libraries are loaded
			await updateChart(); // Initial draw uses initial prop values

			resizeObserver = new ResizeObserver(handleResize);
			if (chartContainer) {
				resizeObserver.observe(chartContainer);
			}
		} catch (err: any) {
			console.error("Initialization failed:", err);
			errorMessage = `Initialization Error: ${err.message}. Please try refreshing.`;
			placeholderElement.textContent = errorMessage;
			isLoading = false;
			isMounted = false;
		}
	});

	onDestroy(() => {
		if (resizeObserver) {
			resizeObserver.disconnect();
		}
		if (chart) {
			chart.destroy();
		}
		isMounted = false;
		currentPlotPoints = [];
		currentTooltipLabels = [];
	});

	// --- Reactive updates based on PROP changes ---
	const debouncedUpdateChart = debounce(updateChart, 150); // Debounce updateChart directly

	// Use reactive statements ($:) to trigger the debounced update
	// Only trigger if the actual prop values have changed since the last update
	$: if (
		isMounted &&
		(selectedParty !== prevSelectedParty ||
			selectedMetric !== prevSelectedMetric ||
			data?.length !== prevDataLength)
	) {
		// console.log("Scatter: Props changed, queueing chart update", { selectedParty, selectedMetric });
		debouncedUpdateChart();
		// Update previous values *after* queuing the update
		prevSelectedParty = selectedParty;
		prevSelectedMetric = selectedMetric;
		prevDataLength = data?.length ?? 0;
	}

	// Separate reactive block for highlight changes (doesn't require full redraw)
	$: if (isMounted && chart && highlightedConstituency !== prevHighlight) {
		// console.log("Scatter: Highlight prop changed:", highlightedConstituency);
		applyHighlight();
		prevHighlight = highlightedConstituency; // Update previous highlight value
	}
</script>

<!-- HTML Template -->
<div
	class="font-sans bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden {compact
		? 'p-3'
		: 'p-4 sm:p-5'}"
>
	<!-- Chart Controls Section REMOVED -->
	<!-- Search Input & Reset Button REMOVED -->

	<!-- Chart Area Container -->
	<div
		bind:this={chartContainer}
		class="relative w-full mx-auto bg-gray-50 rounded border border-gray-100 overflow-hidden shadow-inner mb-4"
		style="max-width: 800px;"
	>
		<canvas bind:this={canvas} style="display: none;"></canvas>
		<div
			bind:this={placeholderElement}
			class="absolute inset-0 flex items-center justify-center text-center p-4 bg-white/90 z-10"
			style:display={isLoading || errorMessage ? "flex" : "none"}
			class:text-red-600={!!errorMessage}
			aria-live="polite"
		>
			<!-- Content set dynamically -->
		</div>
	</div>

	<!-- Stats Display Area -->
	<div bind:this={statsElement} class="py-3 text-center min-h-[20px]">
		{@html statsText}
	</div>

	<!-- Sources and Notes Section -->
	{#if !compact}
		<div class="mt-2 pt-3 border-t border-gray-100 text-xs text-gray-500">
			<div class="flex flex-wrap gap-x-4 gap-y-1 justify-between">
				<div class="flex-1 min-w-[200px]">
					<span class="font-medium">Notes:</span> SEISA (2021)
					combines qualifications and occupation. IMD (2020) measures
					deprivation across income, employment, education, health,
					crime, housing, and environment. <br /> <br />Correlation
					(r) measures linear association (-1 to 1). R² indicates
					proportion of variance explained (0 to 1). Chart excludes
					constituencies with 0% party voteshare or 0 metric value for
					correlation calculation.
				</div>
				<div class="flex-1 min-w-[200px] text-right">
					<span class="font-medium">Data Sources:</span> House of Commons
					Library (2024), Census (2021/22), MySociety, HESA, End Child
					Poverty Coalition (2022/23). Map tiles &copy; Mapbox &copy; OpenStreetMap
					contributors.
				</div>
			</div>
		</div>
	{/if}
</div>
