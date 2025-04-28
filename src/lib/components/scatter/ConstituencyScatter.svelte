<!-- src/lib/components/scatter/ConstituencyScatter.svelte -->
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
		isDatasetVisible(datasetIndex: number): boolean;
	}
	interface ResponsiveFontSizes {
		titleSize: number;
		axisTitleSize: number;
		tickSize: number;
		tooltipTitleSize: number;
		tooltipBodySize: number;
	}

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
	let ss: any = null; // For simple-statistics
	let resizeObserver: ResizeObserver | null = null;
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
	let prevHighlight = highlightedConstituency;

	const dispatch = createEventDispatcher<{
		constituencyClick: { name: string };
	}>();

	// --- Responsive Settings ---
	const smallBreakpoint = 640; // px width threshold for smaller text

	// --- Helper Function to Calculate Font Sizes ---
	function getResponsiveFontSizes(width: number): ResponsiveFontSizes {
		const isSmall = width < smallBreakpoint;
		return {
			titleSize: isSmall ? 14 : 16,
			axisTitleSize: isSmall ? 11 : 12,
			tickSize: isSmall ? 9 : 10,
			tooltipTitleSize: isSmall ? 11 : 13,
			tooltipBodySize: isSmall ? 10 : 11,
		};
	}

	// --- Apply highlight styles without full redraw ---
	function applyHighlight() {
		if (
			!chart ||
			!chart.data.datasets ||
			!chart.data.datasets[0] ||
			!currentPlotPoints ||
			currentPlotPoints.length === 0 ||
			!chart.isDatasetVisible(0)
		) {
			return;
		}

		const dataset = chart.data.datasets[0];
		const defaultPointSize = compact ? 2.5 : 3;
		const highlightedPointSize = compact ? 5 : 6;

		try {
			dataset.pointRadius = currentPlotPoints.map((p) =>
				p.label === highlightedConstituency
					? highlightedPointSize
					: defaultPointSize
			);
			const highlightBorderColor = "#1D4ED8"; // Tailwind blue-700
			dataset.borderColor = currentPlotPoints.map((p) =>
				p.label === highlightedConstituency
					? highlightBorderColor
					: "transparent"
			);
			dataset.borderWidth = currentPlotPoints.map((p) =>
				p.label === highlightedConstituency ? 1.5 : 0
			);

			chart.update("none");
		} catch (e) {
			console.error("Error updating chart highlight:", e);
		}
	}

	// --- Select constituency and DISPATCH event ---
	function dispatchConstituencyClick(name: string) {
		console.log("Scatter: Dispatching click for", name);
		dispatch("constituencyClick", { name: name });
	}

	// --- Load Chart.js ---
	async function loadChartLibraries() {
		if (window.Chart && typeof ss?.linearRegression === "function") {
			return;
		}
		try {
			const [chartModule, simpleStatsModule] = await Promise.all([
				window.Chart
					? Promise.resolve({
							Chart: window.Chart,
							register: window.Chart.register,
						})
					: import("chart.js/auto"),
				import("simple-statistics"),
			]);

			if (!window.Chart && chartModule.Chart) {
				window.Chart = chartModule.Chart;
				console.log("Scatter: Chart.js loaded via dynamic import.");
			} else {
				console.log("Scatter: Chart.js already available.");
			}

			ss = simpleStatsModule;
			if (typeof ss?.linearRegression !== "function") {
				throw new Error(
					"Simple statistics library failed to load correctly."
				);
			}
			console.log("Scatter: Simple-statistics loaded.");
		} catch (e) {
			console.error("Failed to load chart libraries:", e);
			throw new Error(`Failed to load chart libraries: ${e}`);
		}
	}

	// --- Main chart update function ---
	async function updateChart() {
		if (
			!isMounted ||
			!canvas ||
			!placeholderElement ||
			!statsElement ||
			!chartContainer ||
			typeof window.Chart !== "function" ||
			typeof ss?.linearRegression !== "function"
		) {
			console.warn(
				"Scatter: updateChart called before mount or library load. Aborting."
			);
			isLoading = false;
			return;
		}

		if (!Array.isArray(data)) {
			console.error(
				"Scatter: Data prop is not an array!",
				typeof data,
				data
			);
			errorMessage =
				"Chart Error: Invalid data received. Expected an array.";
			placeholderElement.innerHTML = `<p class="text-sm text-red-600 p-4">${errorMessage}</p>`;
			placeholderElement.style.display = "flex";
			canvas.style.display = "none";
			isLoading = false;
			if (chart) {
				chart.destroy();
				chart = null;
			}
			return;
		}

		errorMessage = null;
		statsText = "";
		isLoading = true;

		if (!chart) {
			placeholderElement.innerHTML = `
				<div class="flex flex-col items-center justify-center text-center p-4">
					<svg class="animate-spin h-6 w-6 text-blue-600 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					<p class="text-gray-500 text-xs font-medium">Analyzing data...</p>
				</div>`;
		}
		canvas.style.display = "none";
		placeholderElement.style.display = "flex";

		await new Promise((resolve) => setTimeout(resolve, 10));

		try {
			const containerWidth = chartContainer.clientWidth;
			if (containerWidth === 0) {
				console.warn(
					"Scatter: Chart container width is 0. Skipping update."
				);
				isLoading = false;
				placeholderElement.innerHTML = `<p class="text-xs text-orange-600 p-4">Chart container not ready.</p>`;
				return;
			}
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
					`${name}-${xVal}-${yVal}-${Math.random()}`;

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

			let regressionLinePoints: { x: number; y: number }[] = [];
			let pearsonR: number = NaN;
			let rSquared: number = NaN;
			let n: number = 0;

			if (statPoints.length < 5) {
				console.warn(
					`Not enough valid data points (${statPoints.length}) for correlation.`
				);
				n = statPoints.length;
			} else {
				n = statPoints.length;
				try {
					const xValues = statPoints.map((p) => p[0]);
					const yValues = statPoints.map((p) => p[1]);
					const regression = ss.linearRegression(statPoints);
					const regressionFunction =
						ss.linearRegressionLine(regression);
					pearsonR = ss.sampleCorrelation(xValues, yValues);
					rSquared = pearsonR * pearsonR;

					const xMin = ss.min(xValues);
					const xMax = ss.max(xValues);
					const numPoints = 20;
					const xStep = (xMax - xMin) / (numPoints - 1);
					for (let i = 0; i < numPoints; i++) {
						const x = xMin + i * xStep;
						const y = regressionFunction(x);
						if (isFinite(y)) {
							regressionLinePoints.push({ x, y });
						}
					}
				} catch (statError) {
					console.warn(
						"Scatter: Error during statistical calculation:",
						statError
					);
					pearsonR = NaN;
					rSquared = NaN;
					regressionLinePoints = [];
				}
			}

			const defaultPointSize = compact ? 2.5 : 3;
			const pointSizes = currentPlotPoints.map(() => defaultPointSize);
			const pointBorderColors = currentPlotPoints.map(
				() => "transparent"
			);
			const pointBorderWidths = currentPlotPoints.map(() => 0);

			const datasets: any[] = [
				{
					label: "Constituencies",
					data: currentPlotPoints.map((p) => ({ x: p.x, y: p.y })),
					backgroundColor: color,
					borderColor: pointBorderColors,
					borderWidth: pointBorderWidths,
					pointRadius: pointSizes,
					pointHoverRadius: compact ? 5 : 6,
					pointHitRadius: compact ? 8 : 10,
					pointHoverBorderWidth: 1.5,
					pointHoverBackgroundColor: color,
					pointHoverBorderColor: "#000000",
					order: 1,
				},
			];
			if (regressionLinePoints.length > 1) {
				datasets.push({
					type: "line",
					label: "Trend",
					data: regressionLinePoints,
					backgroundColor: "transparent",
					borderColor: "rgba(0, 0, 0, 0.4)",
					borderWidth: 1,
					borderDash: [4, 4],
					pointRadius: 0, // No visible points on the line
					fill: false,
					tension: 0.1,
					order: 0,
					// --- Disable interaction for the trend line ---
					pointHitRadius: 0, // No hit detection for points
					pointHoverRadius: 0, // No hover effect for points
					hitRadius: 0, // No hit detection for the line itself
					hoverRadius: 0, // No hover effect for the line itself
					// --- End interaction disabling ---
				});
			}

			const chartTitleText =
				title || `${selectedPartyLabel} vs ${selectedMetricLabel}`;

			const formatXAxisTick = (value: any) => {
				const numValue = Number(value);
				if (isNaN(numValue)) return value;
				if (
					selectedMetricLabel.includes("(£)") ||
					selectedMetricLabel.toLowerCase().includes("price") ||
					selectedMetricLabel.toLowerCase().includes("income")
				) {
					return numValue >= 1000
						? `£${(numValue / 1000).toFixed(0)}k`
						: `£${numValue.toLocaleString()}`;
				}
				if (selectedMetricLabel.includes("(%)")) {
					return `${numValue.toFixed(0)}%`;
				}
				if (Math.abs(numValue) >= 10000)
					return (numValue / 1000).toFixed(0) + "k";
				if (Math.abs(numValue) < 10 && numValue !== 0)
					return numValue.toFixed(1);
				return numValue.toLocaleString(undefined, {
					maximumFractionDigits: 0,
				});
			};

			const formatYAxisTick = (value: any) => {
				const numValue = Number(value);
				if (isNaN(numValue)) return value;
				return `${numValue.toFixed(0)}%`;
			};

			const tooltipLabelCallback = (context: any) => {
				const index = context.dataIndex;
				const datasetIndex = context.datasetIndex;
				// Only show tooltips for the main scatter points (datasetIndex 0)
				if (
					datasetIndex === 0 &&
					index >= 0 &&
					index < currentTooltipLabels.length
				) {
					const pointLabel = currentTooltipLabels[index];
					const x = context.parsed.x.toLocaleString(undefined, {
						maximumFractionDigits: 1,
					});
					const y = context.parsed.y.toLocaleString(undefined, {
						maximumFractionDigits: 1,
					});
					return [
						pointLabel,
						`${selectedMetricLabel.split("(")[0].trim()}: ${x}`,
						`${selectedPartyLabel.split("(")[0].trim()}: ${y}%`,
					];
				}
				// Return null for other datasets (like the trend line)
				return null;
			};

			if (chart) {
				chart.data.datasets = datasets;
				chart.options.plugins.title.text = chartTitleText;
				chart.options.plugins.title.display =
					!compact && !!chartTitleText;
				chart.options.scales.x.title.text = selectedMetricLabel;
				chart.options.scales.y.title.text = selectedPartyLabel;
				chart.options.plugins.tooltip.callbacks.label =
					tooltipLabelCallback;
				// Update font sizes
				chart.options.plugins.title.font.size = fontSizes.titleSize;
				chart.options.scales.x.title.font.size =
					fontSizes.axisTitleSize;
				chart.options.scales.y.title.font.size =
					fontSizes.axisTitleSize;
				chart.options.scales.x.ticks.font.size = fontSizes.tickSize;
				chart.options.scales.y.ticks.font.size = fontSizes.tickSize;
				chart.options.plugins.tooltip.titleFont.size =
					fontSizes.tooltipTitleSize;
				chart.options.plugins.tooltip.bodyFont.size =
					fontSizes.tooltipBodySize;

				chart.update("none");
				applyHighlight();
			} else {
				const ctx = canvas.getContext("2d");
				if (!ctx) throw new Error("Could not get canvas context.");
				chart = new window.Chart(ctx, {
					type: "scatter",
					data: { datasets },
					options: {
						responsive: true,
						maintainAspectRatio: false,
						animation: { duration: 0 },
						layout: {
							padding: compact
								? { top: 5, right: 5, bottom: 5, left: 0 }
								: { top: 10, right: 15, bottom: 5, left: 5 },
						},
						interaction: {
							mode: "nearest", // Still useful for finding the nearest *scatter* point
							intersect: false,
							axis: "xy",
						},
						plugins: {
							legend: { display: false },
							tooltip: {
								enabled: true,
								backgroundColor: "rgba(0, 0, 0, 0.8)",
								titleColor: "#ffffff",
								bodyColor: "#ffffff",
								borderColor: "rgba(255,255,255,0.1)",
								borderWidth: 1,
								padding: compact ? 6 : 8,
								cornerRadius: 3,
								displayColors: false,
								titleFont: {
									weight: "bold",
									size: fontSizes.tooltipTitleSize,
								},
								bodyFont: { size: fontSizes.tooltipBodySize },
								callbacks: {
									label: tooltipLabelCallback,
								},
								// Filter out tooltips for the trend line dataset
								filter: function (tooltipItem) {
									return tooltipItem.datasetIndex === 0;
								},
							},
							title: {
								display: !compact && !!chartTitleText,
								text: chartTitleText,
								align: "start",
								padding: { top: 0, bottom: compact ? 10 : 15 },
								font: {
									size: fontSizes.titleSize,
									weight: "500",
									family: "system-ui, sans-serif",
								},
								color: "#111827",
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
										family: "system-ui, sans-serif",
										weight: "400",
									},
									color: "#4B5563",
									padding: { top: compact ? 4 : 8 },
								},
								grid: { color: "#E5E7EB", drawBorder: false },
								ticks: {
									color: "#6B7280",
									font: { size: fontSizes.tickSize },
									maxTicksLimit: compact ? 4 : 6,
									padding: 5,
									callback: formatXAxisTick,
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
										family: "system-ui, sans-serif",
										weight: "400",
									},
									color: "#4B5563",
									padding: { bottom: compact ? 4 : 8 },
								},
								grid: { color: "#E5E7EB", drawBorder: false },
								ticks: {
									color: "#6B7280",
									font: { size: fontSizes.tickSize },
									maxTicksLimit: compact ? 4 : 6,
									padding: 5,
									callback: formatYAxisTick,
								},
							},
						},
						onClick: (_event: MouseEvent, elements: any[]) => {
							if (!elements || elements.length === 0) return;
							const element = elements[0];
							// Ensure click is only processed for the main scatter dataset (index 0)
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
							}
						},
					},
				});
				applyHighlight();
			}

			// Update stats text area
			if (!isNaN(pearsonR)) {
				statsText = `
					<div class="text-center text-gray-600 text-xs px-2">
						Correlation (r): <span class="font-medium ${Math.abs(pearsonR) > 0.5 ? "text-blue-700" : Math.abs(pearsonR) > 0.2 ? "text-blue-600" : "text-gray-700"}">${pearsonR.toFixed(2)}</span>
						<span class="mx-1.5 text-gray-300">|</span>
						R²: <span class="font-medium ${rSquared > 0.25 ? "text-blue-700" : rSquared > 0.04 ? "text-blue-600" : "text-gray-700"}">${rSquared.toFixed(2)}</span>
						<span class="mx-1.5 text-gray-300">|</span>
						N: ${n.toLocaleString()}
					</div>
				`;
			} else if (statPoints.length < 5 && n > 0) {
				statsText = `<div class="text-center text-gray-500 text-xs px-2 italic">N=${n.toLocaleString()} (Not enough data for correlation)</div>`;
			} else {
				statsText = `<div class="text-center text-gray-500 text-xs px-2 italic">Correlation not calculated</div>`;
			}

			placeholderElement.style.display = "none";
			canvas.style.display = "block";
			isLoading = false;
		} catch (e: any) {
			console.error("Scatter: Chart update error:", e);
			errorMessage = `Chart Error: ${e.message}`;
			placeholderElement.innerHTML = `<p class="text-sm text-red-600 p-4">${errorMessage}</p>`;
			placeholderElement.style.display = "flex";
			canvas.style.display = "none";
			statsText = "";
			currentPlotPoints = [];
			currentTooltipLabels = [];
			if (chart) {
				chart.destroy();
				chart = null;
			}
			isLoading = false;
		}
	}

	// --- Resize handler ---
	const handleResize = debounce(() => {
		if (!chart || !chartContainer || !isMounted || !window.Chart) return;
		const newWidth = chartContainer.clientWidth;
		const newFontSizes = getResponsiveFontSizes(newWidth);
		let optionsChanged = false;

		// Update font sizes if they differ
		if (
			chart.options?.plugins?.title?.font &&
			chart.options.plugins.title.font.size !== newFontSizes.titleSize
		) {
			chart.options.plugins.title.font.size = newFontSizes.titleSize;
			optionsChanged = true;
		}
		if (
			chart.options?.scales?.x?.title?.font &&
			chart.options.scales.x.title.font.size !==
				newFontSizes.axisTitleSize
		) {
			chart.options.scales.x.title.font.size = newFontSizes.axisTitleSize;
			optionsChanged = true;
		}
		if (
			chart.options?.scales?.y?.title?.font &&
			chart.options.scales.y.title.font.size !==
				newFontSizes.axisTitleSize
		) {
			chart.options.scales.y.title.font.size = newFontSizes.axisTitleSize;
			optionsChanged = true;
		}
		if (
			chart.options?.scales?.x?.ticks?.font &&
			chart.options.scales.x.ticks.font.size !== newFontSizes.tickSize
		) {
			chart.options.scales.x.ticks.font.size = newFontSizes.tickSize;
			optionsChanged = true;
		}
		if (
			chart.options?.scales?.y?.ticks?.font &&
			chart.options.scales.y.ticks.font.size !== newFontSizes.tickSize
		) {
			chart.options.scales.y.ticks.font.size = newFontSizes.tickSize;
			optionsChanged = true;
		}
		if (
			chart.options?.plugins?.tooltip?.titleFont &&
			chart.options.plugins.tooltip.titleFont.size !==
				newFontSizes.tooltipTitleSize
		) {
			chart.options.plugins.tooltip.titleFont.size =
				newFontSizes.tooltipTitleSize;
			optionsChanged = true;
		}
		if (
			chart.options?.plugins?.tooltip?.bodyFont &&
			chart.options.plugins.tooltip.bodyFont.size !==
				newFontSizes.tooltipBodySize
		) {
			chart.options.plugins.tooltip.bodyFont.size =
				newFontSizes.tooltipBodySize;
			optionsChanged = true;
		}

		if (optionsChanged) {
			chart.update("none");
		}
	}, 150);

	// --- Lifecycle ---
	onMount(async () => {
		isMounted = true;
		isLoading = true;
		errorMessage = null;

		placeholderElement.innerHTML = `
			<div class="flex flex-col items-center justify-center text-center p-4">
				 <svg class="animate-spin h-6 w-6 text-blue-600 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<p class="text-gray-500 text-xs font-medium">Loading Chart...</p>
			</div>`;
		placeholderElement.style.display = "flex";
		canvas.style.display = "none";

		try {
			await loadChartLibraries();
			await updateChart(); // Initial chart render

			resizeObserver = new ResizeObserver(handleResize);
			if (chartContainer) {
				resizeObserver.observe(chartContainer);
			}
		} catch (err: any) {
			console.error("Scatter: Initialization failed:", err);
			errorMessage = `Initialization Error: ${err.message}.`;
			placeholderElement.innerHTML = `<p class="text-sm text-red-600 p-4">${errorMessage}</p>`;
			isLoading = false;
			isMounted = false;
		}
	});

	onDestroy(() => {
		isMounted = false;
		if (resizeObserver && chartContainer) {
			resizeObserver.unobserve(chartContainer);
		}
		resizeObserver = null;
		if (chart) {
			chart.destroy();
			chart = null;
		}
		currentPlotPoints = [];
		currentTooltipLabels = [];
		console.log("Scatter: Destroyed.");
	});

	// --- Reactive updates based on PROP changes ---
	const debouncedUpdateChart = debounce(updateChart, 200);

	$: if (
		isMounted &&
		typeof window.Chart === "function" &&
		typeof ss?.linearRegression === "function"
	) {
		if (
			selectedParty !== prevSelectedParty ||
			selectedMetric !== prevSelectedMetric ||
			data?.length !== prevDataLength
		) {
			debouncedUpdateChart();
			prevSelectedParty = selectedParty;
			prevSelectedMetric = selectedMetric;
			prevDataLength = data?.length ?? 0;
		}
	}

	// Apply highlight reactively
	$: if (isMounted && chart && highlightedConstituency !== prevHighlight) {
		applyHighlight();
		prevHighlight = highlightedConstituency;
	}
</script>

<!-- HTML Template -->
<div
	class="font-sans bg-white rounded-lg border border-gray-200/75 {compact
		? 'p-2'
		: 'p-3 sm:p-4'}"
>
	<!-- Chart Area Container -->
	<div
		bind:this={chartContainer}
		class="relative w-full mx-auto bg-gray-50/30 rounded border border-gray-200/60 overflow-hidden mb-2 sm:mb-3"
		style:min-height={compact ? "280px" : "350px"}
		style:aspect-ratio={compact ? "1 / 1" : "16 / 10"}
		style:max-height={compact ? "350px" : "500px"}
	>
		<canvas
			bind:this={canvas}
			class="absolute inset-0 w-full h-full"
			style="display: none;"
		></canvas>
		<div
			bind:this={placeholderElement}
			class="absolute inset-0 flex items-center justify-center text-center p-4 bg-white/80 z-10 transition-opacity duration-150"
			style:display={isLoading || errorMessage ? "flex" : "none"}
			class:opacity-100={isLoading || errorMessage}
			class:opacity-0={!isLoading && !errorMessage}
			aria-live="polite"
		>
			<!-- Content set dynamically -->
		</div>
	</div>

	<!-- Stats Display Area -->
	<div
		bind:this={statsElement}
		class="py-1.5 text-center min-h-[24px] bg-gray-100/60 rounded border border-gray-200/50 mb-3"
	>
		{@html statsText ||
			'<div class="text-xs text-gray-400 italic px-2">...</div>'}
	</div>

	<!-- Sources and Notes Section -->
	{#if !compact}
		<div
			class="mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500 space-y-1.5"
		>
			<p>
				<span class="font-medium text-gray-600">Notes:</span>
				IMD = Index of Multiple Deprivation (2019/20). SEISA = Skills and
				Employment (2021). Click points to highlight.
			</p>
		</div>
	{/if}
</div>
