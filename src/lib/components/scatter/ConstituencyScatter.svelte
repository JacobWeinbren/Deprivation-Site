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

	// Basic type for a Chart.js instance
	interface ChartInstance {
		destroy(): void;
		update(mode?: "none" | "resize" | "reset" | "active"): void;
		resize(): void;
		data: any;
		options: any;
	}

	// Structure for responsive font sizes
	interface ResponsiveFontSizes {
		titleSize: number;
		axisTitleSize: number;
		tickSize: number;
		annotationSize: number;
		tooltipTitleSize: number;
		tooltipBodySize: number;
	}

	import { onMount, onDestroy, createEventDispatcher } from "svelte";
	import {
		parties,
		metrics,
		partyColors,
		type ConstituencyData,
	} from "./chartConfig";
	import { getNumericValue, debounce } from "./utils";

	// Props
	export let data: ConstituencyData[] = [];
	export let preselectedParty: string = "lab_voteshare";
	export let preselectedMetric: string = "overall_local_score";
	export let title: string = "";
	export let compact: boolean = false;
	export let id: string = Math.random().toString(36).substring(2, 9);

	// State
	let chartContainer: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let placeholderElement: HTMLDivElement;
	let statsElement: HTMLDivElement;
	let selectedParty: string = preselectedParty;
	let selectedMetric: string = preselectedMetric;
	let isLoading: boolean = true;
	let errorMessage: string | null = null;
	let statsText: string = "";
	let isMounted: boolean = false;
	let chart: ChartInstance | null = null;
	let ss: any = null;
	let resizeObserver: ResizeObserver | null = null;
	let highlightedConstituency: string | null = null;
	let searchTerm: string = "";
	let searchResults: string[] = [];
	let currentPlotPoints: {
		x: number;
		y: number;
		label: string;
		id: string;
	}[] = [];
	let currentTooltipLabels: string[] = [];

	const dispatch = createEventDispatcher();

	// --- Responsive Settings ---
	const smallBreakpoint = 640; // px width threshold for smaller text

	// --- Helper Function to Calculate Font Sizes ---
	function getResponsiveFontSizes(width: number): ResponsiveFontSizes {
		const isSmall = width < smallBreakpoint;
		return {
			titleSize: isSmall ? 14 : 16,
			axisTitleSize: isSmall ? 11 : 13,
			tickSize: isSmall ? 9 : 11,
			annotationSize: isSmall ? 9 : 11,
			tooltipTitleSize: isSmall ? 11 : 13,
			tooltipBodySize: isSmall ? 10 : 12,
		};
	}

	// Setup option groups
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
			groupMap
				.get(group)
				?.push({ value: metric.value, label: metric.label });
		});
		orderedGroupedMetrics = groupOrder.map((groupName) => ({
			groupName,
			options: groupMap.get(groupName) || [],
		}));
	}

	// Search functionality
	$: {
		if (searchTerm.length > 1) {
			const term = searchTerm.toLowerCase();
			const sourceData =
				currentPlotPoints.length > 0 ? currentPlotPoints : data;
			searchResults = sourceData
				.filter((d) =>
					(d.label || d.constituency_name)
						?.toLowerCase()
						.includes(term)
				)
				.slice(0, 5)
				.map((d) => d.label || d.constituency_name);
		} else {
			searchResults = [];
		}
	}

	// Apply highlight styles without full redraw
	function applyHighlight() {
		if (!chart || !chart.data.datasets || !chart.data.datasets[0]) return;
		if (!currentPlotPoints || currentPlotPoints.length === 0) return;

		const dataset = chart.data.datasets[0];
		const defaultPointSize = 3;
		const highlightedPointSize = 6;

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
		chart.update("none");
	}

	// Select constituency and highlight
	function selectConstituency(name: string) {
		if (highlightedConstituency !== name) {
			highlightedConstituency = name;
			searchTerm = "";
			searchResults = [];
			applyHighlight();
			dispatch("constituencyClick", { name: name });
		} else {
			searchTerm = "";
			searchResults = [];
		}
	}

	// Reset highlight and search
	function resetView() {
		if (highlightedConstituency !== null || searchTerm !== "") {
			highlightedConstituency = null;
			searchTerm = "";
			searchResults = [];
			applyHighlight();
		}
	}

	// Load Chart.js and plugins dynamically
	async function loadChartLibraries() {
		if (!window.Chart) {
			try {
				const [
					chartModule,
					chartTrendlineModule,
					chartAnnotationModule,
				] = await Promise.all([
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
					chartTrendlineModule.default,
					chartAnnotationModule.default
				);
				window.Chart = Chart;
			} catch (e) {
				console.error("Failed to load Chart.js or plugins:", e);
				throw new Error(
					"Failed to load chart library. Please refresh the page."
				);
			}
		}
	}

	// --- Main chart update function (full redraw) ---
	async function updateChart() {
		if (
			!isMounted ||
			!canvas ||
			!placeholderElement ||
			!statsElement ||
			!ss ||
			!chartContainer // Ensure container exists
		) {
			isLoading = false;
			return;
		}

		isLoading = true;
		errorMessage = null;
		statsText = "";
		placeholderElement.innerHTML = `
      <div class="flex flex-col items-center justify-center text-center">
        <div class="animate-pulse flex space-x-2 mb-2">
          <div class="h-2 w-2 bg-gray-400 rounded-full"></div>
          <div class="h-2 w-2 bg-gray-400 rounded-full"></div>
          <div class="h-2 w-2 bg-gray-400 rounded-full"></div>
        </div>
        <p class="text-gray-600 text-sm">Analyzing data...</p>
      </div>`;
		canvas.style.display = "none";
		placeholderElement.style.display = "flex";

		await new Promise(requestAnimationFrame);

		try {
			await loadChartLibraries();

			// --- Get current width and calculate font sizes ---
			const containerWidth = chartContainer.clientWidth;
			const fontSizes = getResponsiveFontSizes(containerWidth);
			// ---

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
				const id = String(
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
					name
				) {
					plotPoints.push({ x: xVal, y: yVal, label: name, id });
					statPoints.push([xVal, yVal]);
				}
			}
			currentPlotPoints = [...plotPoints];
			currentTooltipLabels = currentPlotPoints.map((p) => p.label);

			if (statPoints.length < 3) {
				throw new Error(
					"Not enough valid data points (need at least 3) to calculate correlation."
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
				if (y < 0) y = 0;
				regressionPoints.push({ x, y });
			}
			regressionLine = {
				x: regressionPoints.map((p) => p.x),
				y: regressionPoints.map((p) => p.y),
			};

			// Destroy previous chart
			if (chart) {
				chart.destroy();
				chart = null;
			}

			// Configure point appearance
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
			const ctx = canvas.getContext("2d");
			if (!ctx) throw new Error("Could not get canvas context.");

			// --- Create Chart with Responsive Font Sizes ---
			chart = new window.Chart(ctx, {
				type: "scatter",
				data: { datasets },
				options: {
					responsive: true,
					maintainAspectRatio: true,
					aspectRatio: 1.6,
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
							// Use responsive sizes
							titleFont: {
								weight: "bold",
								size: fontSizes.tooltipTitleSize,
							},
							bodyFont: { size: fontSizes.tooltipBodySize },
							callbacks: {
								label: function (context: any) {
									const index = context.dataIndex;
									const datasetIndex = context.datasetIndex;
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
								// Use responsive size
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
									// Use responsive size
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
								// Use responsive size
								font: { size: fontSizes.tickSize },
								callback: function (value: any) {
									const numValue = Number(value);
									if (isNaN(numValue)) return value;
									if (
										currentMetric.includes("price") ||
										currentMetric.includes("income")
									) {
										return numValue >= 1000
											? (numValue / 1000).toFixed(0) + "k"
											: numValue.toLocaleString();
									}
									return numValue.toLocaleString(undefined, {
										maximumFractionDigits: 1,
									});
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
									// Use responsive size
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
								// Use responsive size
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
								selectConstituency(currentTooltipLabels[index]);
							}
						}
					},
				},
			});

			statsText = `
        <div class="text-center text-gray-600 text-sm">
          <span class="font-medium">Pearson correlation (r):</span> ${pearsonR.toFixed(3)}
          <span class="mx-2">|</span>
          <span class="font-medium">R²:</span> ${rSquared.toFixed(3)}
          <span class="mx-2">|</span>
          <span class="font-medium">Constituencies:</span> ${n.toLocaleString()}
        </div>`;

			placeholderElement.style.display = "none";
			canvas.style.display = "block";
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
			}
		} finally {
			isLoading = false;
		}
	}

	// --- MODIFIED: Resize handler updates font sizes ---
	const handleResize = debounce(() => {
		if (!chart || !chartContainer || !isMounted) return;

		// 1. Let Chart.js handle canvas resizing first
		chart.resize();

		// 2. Get new font sizes based on the potentially new container width
		const newWidth = chartContainer.clientWidth;
		const newFontSizes = getResponsiveFontSizes(newWidth);

		// 3. Update the font sizes in the chart's options object
		// Note: Need to check if options and nested properties exist
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
		if (
			chart.options?.plugins?.annotation?.annotations?.correlationText
				?.font
		) {
			chart.options.plugins.annotation.annotations.correlationText.font.size =
				newFontSizes.annotationSize;
		}
		if (chart.options?.plugins?.tooltip?.titleFont) {
			chart.options.plugins.tooltip.titleFont.size =
				newFontSizes.tooltipTitleSize;
		}
		if (chart.options?.plugins?.tooltip?.bodyFont) {
			chart.options.plugins.tooltip.bodyFont.size =
				newFontSizes.tooltipBodySize;
		}

		// 4. Apply the option changes visually
		chart.update("none"); // 'none' prevents re-animation
	}, 150); // Debounce resize events

	onMount(async () => {
		isLoading = true;
		errorMessage = null;
		placeholderElement.innerHTML = `... Loading ...`; // Simplified placeholder
		placeholderElement.style.display = "flex";
		canvas.style.display = "none";

		try {
			ss = await import("simple-statistics");
			if (typeof ss?.linearRegression !== "function") {
				throw new Error("Statistics library failed to load correctly.");
			}

			isMounted = true;
			await updateChart(); // Initial full draw (calculates initial font sizes)

			// Setup ResizeObserver with the modified handler
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

	// Reactive updates for Party/Metric still trigger full redraw
	$: if (isMounted && (selectedParty || selectedMetric)) {
		const debouncedUpdate = debounce(updateChart, 100);
		debouncedUpdate();
	}
</script>

<!-- HTML Template (No changes needed here from previous version) -->
<div
	class="font-sans bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden {compact
		? 'p-3'
		: 'p-4 sm:p-5'}"
>
	<!-- Chart Controls Section -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
		<!-- Party Selection Dropdown -->
		<div class="min-w-[180px]">
			<label
				for="party-select-{id}"
				class="block text-xs font-medium text-gray-500 mb-1"
			>
				Party (Y-Axis):
			</label>
			<div class="relative">
				<select
					id="party-select-{id}"
					bind:value={selectedParty}
					class="block w-full pl-3 pr-8 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out disabled:opacity-70 disabled:bg-gray-50"
					disabled={isLoading}
				>
					{#each parties as party (party.value)}
						<option value={party.value}>{party.label}</option>
					{/each}
				</select>
				<div
					class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500"
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
							d="M19 9l-7 7-7-7"
						></path>
					</svg>
				</div>
			</div>
		</div>

		<!-- Metric Selection Dropdown -->
		<div class="min-w-[180px]">
			<label
				for="metric-select-{id}"
				class="block text-xs font-medium text-gray-500 mb-1"
			>
				Metric (X-Axis):
			</label>
			<div class="relative">
				<select
					id="metric-select-{id}"
					bind:value={selectedMetric}
					class="block w-full pl-3 pr-8 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out disabled:opacity-70 disabled:bg-gray-50"
					disabled={isLoading}
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
					class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500"
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
							d="M19 9l-7 7-7-7"
						></path>
					</svg>
				</div>
			</div>
		</div>

		<!-- Constituency Search Input (only if not compact) -->
		{#if !compact}
			<div class="min-w-[180px] relative">
				<label
					for="search-input-{id}"
					class="block text-xs font-medium text-gray-500 mb-1"
				>
					Find Constituency:
				</label>
				<div class="relative">
					<input
						id="search-input-{id}"
						type="text"
						placeholder="Type to search..."
						bind:value={searchTerm}
						class="block w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out disabled:opacity-70 disabled:bg-gray-50"
						disabled={isLoading}
						aria-label="Search for a constituency"
					/>
					<div
						class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"
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
				</div>
				{#if searchTerm && searchResults.length > 0}
					<div
						class="absolute z-20 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-auto py-1"
						role="listbox"
					>
						{#each searchResults as result (result)}
							<button
								role="option"
								class="block w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-50 focus:outline-none focus:bg-blue-100 transition duration-150 ease-in-out"
								on:click={() => selectConstituency(result)}
							>
								{result}
							</button>
						{/each}
					</div>
				{:else if searchTerm && searchResults.length === 0}
					<div
						class="absolute z-20 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-500"
					>
						No results found.
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Reset View Button (only if not compact) -->
	{#if !compact}
		<div class="flex items-center justify-end mb-3 -mt-2">
			<button
				on:click={resetView}
				disabled={!highlightedConstituency && !searchTerm}
				class="flex items-center py-1 px-2 text-xs text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
				aria-label="Reset chart view and clear selection"
			>
				<svg
					class="w-3.5 h-3.5 mr-1"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					></path>
				</svg>
				Reset View
			</button>
		</div>
	{/if}

	<!-- Chart Area Container -->
	<div
		bind:this={chartContainer}
		class="relative w-full mx-auto bg-gray-50 rounded border border-gray-100 overflow-hidden shadow-inner"
		style="max-width: 800px;"
	>
		<canvas bind:this={canvas} style="display: none;"></canvas>
		<div
			bind:this={placeholderElement}
			class="absolute inset-0 flex items-center justify-center text-center p-4 bg-white/90 z-10"
			style:display={isLoading || errorMessage ? "flex" : "none"}
			class:text-red-600={errorMessage}
			aria-live="polite"
		>
			<!-- Content set in JS -->
		</div>
	</div>

	<!-- Stats Display Area -->
	<div bind:this={statsElement} class="py-3 text-center min-h-[20px]">
		{@html statsText}
	</div>

	<!-- Sources and Notes Section (only if not compact) -->
	{#if !compact}
		<div class="mt-2 pt-3 border-t border-gray-100 text-xs text-gray-500">
			<div class="flex flex-wrap gap-x-4 gap-y-1 justify-between">
				<div class="flex-1 min-w-[200px]">
					<span class="font-medium">Notes:</span> SEISA (2021) combines
					qualifications and occupation. IMD (2020) measures deprivation
					across income, employment, education, health, crime, housing,
					and environment. Correlation (r) measures linear association
					(-1 to 1). R² indicates proportion of variance explained (0 to
					1).
				</div>
				<div class="flex-1 min-w-[200px] text-right">
					<span class="font-medium">Data Sources:</span> House of Commons
					Library (2024), Census (2021/22), MySociety, HESA, End Child
					Poverty Coalition (2022/23).
				</div>
			</div>
		</div>
	{/if}
</div>
