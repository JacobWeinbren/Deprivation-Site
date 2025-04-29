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

	import { onMount, onDestroy, createEventDispatcher } from "svelte";
	import {
		type ConstituencyData,
		type MetricOption,
		type PartyOption,
	} from "./chartConfig";
	import { getNumericValue, debounce } from "./utils";
	import { getResponsiveFontSizes, formatLegendLabel } from "./ChartUtils"; // Removed formatLegendLabel as it's not used here
	import ChartStatistics from "./ChartStatistics.svelte";
	import ChartPlaceholder from "./ChartPlaceholder.svelte";
	import ChartNotes from "./ChartNotes.svelte";

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
	let isLoading: boolean = true;
	let errorMessage: string | null = null;
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

	// Statistics state
	let pearsonR: number | null = null;
	let rSquared: number | null = null;
	let n: number = 0;

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

	// --- Apply highlight styles without full redraw ---
	function applyHighlight() {
		if (
			!chart ||
			!chart.data.datasets ||
			!chart.data.datasets[0] ||
			!currentPlotPoints ||
			currentPlotPoints.length === 0 ||
			!chart.isDatasetVisible(0) // Check if dataset is visible
		) {
			return;
		}

		const dataset = chart.data.datasets[0];
		const defaultPointSize = compact ? 2.5 : 3;
		const highlightedPointSize = compact ? 5 : 6;

		try {
			// Ensure dataset.pointRadius is an array before mapping
			if (!Array.isArray(dataset.pointRadius)) {
				// Initialize if it's not an array (might happen on first load)
				dataset.pointRadius = currentPlotPoints.map(
					() => defaultPointSize
				);
			}

			dataset.pointRadius = currentPlotPoints.map((p) =>
				p.label === highlightedConstituency
					? highlightedPointSize
					: defaultPointSize
			);

			const highlightBorderColor = "#1D4ED8"; // Tailwind blue-700
			// Ensure dataset.borderColor is an array
			if (!Array.isArray(dataset.borderColor)) {
				dataset.borderColor = currentPlotPoints.map(
					() => "transparent"
				);
			}
			dataset.borderColor = currentPlotPoints.map((p) =>
				p.label === highlightedConstituency
					? highlightBorderColor
					: "transparent"
			);

			// Ensure dataset.borderWidth is an array
			if (!Array.isArray(dataset.borderWidth)) {
				dataset.borderWidth = currentPlotPoints.map(() => 0);
			}
			dataset.borderWidth = currentPlotPoints.map((p) =>
				p.label === highlightedConstituency ? 1.5 : 0
			);

			chart.update("none"); // Use 'none' to avoid re-animation
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
		// Check if libraries are already loaded
		if (window.Chart && typeof ss?.linearRegression === "function") {
			return;
		}
		try {
			// Load libraries concurrently
			const [chartModule, simpleStatsModule] = await Promise.all([
				window.Chart
					? Promise.resolve({
							Chart: window.Chart,
							register: window.Chart.register,
						}) // Use existing if available
					: import("chart.js/auto"),
				import("simple-statistics"),
			]);

			// Assign Chart.js if loaded dynamically
			if (!window.Chart && chartModule.Chart) {
				window.Chart = chartModule.Chart;
				console.log("Scatter: Chart.js loaded via dynamic import.");
			} else if (window.Chart) {
				console.log("Scatter: Chart.js already available.");
			} else {
				throw new Error("Chart.js failed to load or assign.");
			}

			// Assign simple-statistics
			ss = simpleStatsModule;
			if (typeof ss?.linearRegression !== "function") {
				throw new Error(
					"Simple statistics library failed to load correctly."
				);
			}
			console.log("Scatter: Simple-statistics loaded.");
		} catch (e) {
			console.error("Failed to load chart libraries:", e);
			// Propagate error to be handled by the caller (onMount)
			throw new Error(`Failed to load chart libraries: ${e}`);
		}
	}

	// --- Main chart update function ---
	async function updateChart() {
		// Pre-conditions check
		if (
			!isMounted ||
			!canvas ||
			!chartContainer ||
			typeof window.Chart !== "function" ||
			typeof ss?.linearRegression !== "function"
		) {
			console.warn(
				"Scatter: updateChart called before mount or library load. Aborting."
			);
			// Don't set isLoading false here, let onMount handle initial state
			return;
		}

		// Data validation
		if (!Array.isArray(data)) {
			console.error(
				"Scatter: Data prop is not an array!",
				typeof data,
				data
			);
			errorMessage =
				"Chart Error: Invalid data received. Expected an array.";
			isLoading = false; // Stop loading on error
			if (chart) {
				chart.destroy(); // Clean up existing chart
				chart = null;
			}
			return;
		}

		// Reset state for update
		errorMessage = null;
		pearsonR = null;
		rSquared = null;
		n = 0;
		isLoading = true; // Set loading true for the update process

		// Short delay to allow UI to show loading state
		await new Promise((resolve) => setTimeout(resolve, 10));

		try {
			// Check container dimensions
			const containerWidth = chartContainer.clientWidth;
			if (containerWidth === 0 && isMounted) {
				// Only warn if mounted and width is 0
				console.warn(
					"Scatter: Chart container width is 0. Skipping update."
				);
				isLoading = false; // Stop loading
				errorMessage = "Chart container not ready (zero width).";
				return;
			}
			const fontSizes = getResponsiveFontSizes(containerWidth);

			// Get current selections and labels
			const currentParty = selectedParty;
			const currentMetric = selectedMetric;
			const selectedPartyLabel =
				parties.find((p) => p.value === currentParty)?.label ||
				currentParty;
			const selectedMetricLabel =
				metrics.find((m) => m.value === currentMetric)?.label ||
				currentMetric;
			const color = partyColors[currentParty] || "#6B7280"; // Default gray

			// --- Data Processing ---
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
				const id = row.const_code; // Use const_code as the primary ID

				// Filter for valid, non-zero data points with essential info
				if (
					xVal !== null &&
					yVal !== null &&
					isFinite(xVal) &&
					isFinite(yVal) &&
					xVal > 0 && // Ensure x > 0
					yVal > 0 && // Ensure y > 0
					name &&
					id
				) {
					plotPoints.push({ x: xVal, y: yVal, label: name, id });
					statPoints.push([xVal, yVal]);
				}
			}
			// Update state used by other functions (highlight, tooltips)
			currentPlotPoints = [...plotPoints];
			currentTooltipLabels = currentPlotPoints.map((p) => p.label);

			// --- Statistical Calculations ---
			let regressionLinePoints: { x: number; y: number }[] = [];
			pearsonR = NaN; // Use NaN as default for "not calculated"
			rSquared = NaN;
			n = statPoints.length; // Total valid points for stats

			if (n < 5) {
				// Check if enough points for correlation
				console.warn(
					`Scatter: Not enough valid data points (${n}) for correlation.`
				);
			} else {
				try {
					const xValues = statPoints.map((p) => p[0]);
					const yValues = statPoints.map((p) => p[1]);

					// Check for constant values which break correlation/regression
					const xStdDev = ss.standardDeviation(xValues);
					const yStdDev = ss.standardDeviation(yValues);

					if (xStdDev === 0 || yStdDev === 0) {
						console.warn(
							"Scatter: Cannot calculate correlation/regression with constant X or Y values."
						);
					} else {
						const regression = ss.linearRegression(statPoints);
						const regressionFunction =
							ss.linearRegressionLine(regression);
						pearsonR = ss.sampleCorrelation(xValues, yValues);
						rSquared = pearsonR * pearsonR; // Or use ss.rSquared(statPoints, regressionFunction);

						// Generate points for the trend line
						const xMin = ss.min(xValues);
						const xMax = ss.max(xValues);
						const numPoints = 20; // Number of points for the line
						// Avoid division by zero if xMin === xMax (though stdDev check should prevent this)
						const xStep =
							numPoints > 1 && xMax > xMin
								? (xMax - xMin) / (numPoints - 1)
								: 0;

						for (let i = 0; i < numPoints; i++) {
							const x = xMin + i * xStep;
							const y = regressionFunction(x);
							// Ensure generated points are valid numbers
							if (isFinite(x) && isFinite(y)) {
								regressionLinePoints.push({ x, y });
							}
						}
						// Ensure the line has at least two distinct points
						if (regressionLinePoints.length < 2) {
							regressionLinePoints = [];
						}
					}
				} catch (statError) {
					console.error(
						// Log as error as it indicates a problem
						"Scatter: Error during statistical calculation:",
						statError
					);
					// Reset stats on error
					pearsonR = NaN;
					rSquared = NaN;
					regressionLinePoints = [];
				}
			}

			// --- Chart Configuration ---
			const defaultPointSize = compact ? 2.5 : 3;
			const pointSizes = currentPlotPoints.map(() => defaultPointSize);
			const pointBorderColors = currentPlotPoints.map(
				() => "transparent"
			);
			const pointBorderWidths = currentPlotPoints.map(() => 0);

			// Define datasets
			const datasets: any[] = [
				{
					label: "Constituencies",
					data: currentPlotPoints, // Pass the full object for potential future use
					parsing: {
						// Explicitly tell Chart.js how to parse
						xAxisKey: "x",
						yAxisKey: "y",
					},
					backgroundColor: color,
					borderColor: pointBorderColors, // Will be updated by applyHighlight
					borderWidth: pointBorderWidths, // Will be updated by applyHighlight
					pointRadius: pointSizes, // Will be updated by applyHighlight
					pointHoverRadius: compact ? 5 : 6,
					pointHitRadius: compact ? 8 : 10, // Larger hit radius for easier clicking
					pointHoverBorderWidth: 1.5,
					pointHoverBackgroundColor: color,
					pointHoverBorderColor: "#000000", // Black hover border
					order: 1, // Render points on top of the line
				},
			];

			// Add trend line dataset if valid points were generated
			if (regressionLinePoints.length > 1) {
				datasets.push({
					type: "line", // Specify type for mixed charts
					label: "Trend",
					data: regressionLinePoints,
					backgroundColor: "transparent",
					borderColor: "rgba(0, 0, 0, 0.4)", // Semi-transparent black
					borderWidth: 1.5, // Slightly thicker dashed line
					borderDash: [4, 4], // Dashed line style
					pointRadius: 0, // No visible points on the line itself
					fill: false, // Don't fill area under the line
					tension: 0.1, // Slight curve to the line
					order: 0, // Render line underneath points
					// --- Disable interaction for the trend line ---
					pointHitRadius: 0,
					pointHoverRadius: 0,
					hitRadius: 0, // Prevent line itself from being interactive
					hoverRadius: 0,
					// --- End interaction disabling ---
				});
			}

			const chartTitleText =
				title || `${selectedPartyLabel} vs ${selectedMetricLabel}`;

			// --- Axis Tick Formatting ---
			// (Using formatLegendLabel from ChartUtils for consistency, but could be separate)
			const formatXAxisTick = (value: number | string): string => {
				// Chart.js v4 passes value, not context object by default
				const numValue = Number(value);
				if (isNaN(numValue)) return String(value); // Return original if not number
				return formatLegendLabel(numValue, selectedMetricLabel); // Use the imported formatter
			};

			const formatYAxisTick = (value: number | string): string => {
				const numValue = Number(value);
				if (isNaN(numValue)) return String(value);
				// Assuming Y axis is always percentage
				return `${numValue.toFixed(0)}%`;
			};

			// --- Tooltip Callbacks ---
			const tooltipTitleCallback = (tooltipItems: any[]) => {
				// The title callback receives an array of tooltip items
				// For scatter, usually only one item is active
				if (tooltipItems.length > 0) {
					const item = tooltipItems[0];
					const datasetIndex = item.datasetIndex;
					const index = item.dataIndex;
					// Ensure it's for the main scatter dataset and index is valid
					if (
						datasetIndex === 0 &&
						index >= 0 &&
						index < currentPlotPoints.length
					) {
						// Return the constituency name as the title
						return currentPlotPoints[index].label;
					}
				}
				return ""; // Return empty string if no suitable title
			};

			const tooltipLabelCallback = (context: any) => {
				// The label callback formats each line in the body
				const datasetIndex = context.datasetIndex;
				const index = context.dataIndex;

				// Only show body lines for the main scatter points
				if (
					datasetIndex === 0 &&
					index >= 0 &&
					index < currentPlotPoints.length
				) {
					const point = currentPlotPoints[index];

					// Format X value using the same logic as axis ticks
					const xFormatted = formatLegendLabel(
						point.x,
						selectedMetricLabel
					);
					// Format Y value (assuming percentage)
					const yFormatted = `${point.y.toFixed(1)}%`; // Show one decimal in tooltip

					// Return an array containing ONLY the body lines (metric and party)
					// The constituency name is now handled by the title callback
					return [
						`${selectedMetricLabel.split("(")[0].trim()}: ${xFormatted}`, // Metric Label: Value
						`${selectedPartyLabel.split("(")[0].trim()}: ${yFormatted}`, // Party Label: Value
					];
				}
				// Return null or empty array for other datasets (like the trend line)
				return null; // Or return ''; Chart.js handles null/undefined/empty string well here
			};

			// --- Tooltip Configuration (Consistent Style) ---
			const tooltipOptions = {
				enabled: true,
				backgroundColor: "rgba(0, 0, 0, 0.85)",
				titleColor: "#ffffff",
				bodyColor: "#d1d5db", // Light gray body text (gray-300)
				borderColor: "transparent",
				borderWidth: 0,
				padding: compact ? 6 : 8,
				cornerRadius: 4,
				displayColors: false,
				titleFont: {
					weight: "bold", // Keep title bold
					// *** Use the body size for the title as well for consistency ***
					size: fontSizes.tooltipBodySize,
				},
				bodyFont: {
					size: fontSizes.tooltipBodySize, // Body is normal weight by default
				},
				callbacks: {
					// *** Assign BOTH callbacks ***
					title: tooltipTitleCallback,
					label: tooltipLabelCallback,
				},
				filter: function (tooltipItem: any) {
					return tooltipItem.datasetIndex === 0;
				},
			};

			// --- Chart Update or Creation ---
			if (chart) {
				// Update existing chart instance

				// 1. Update Datasets
				chart.data.datasets = datasets;

				// 2. Update General Chart Options (Title, Scales)
				chart.options.plugins.title.text = chartTitleText;
				chart.options.plugins.title.display =
					!compact && !!chartTitleText;
				chart.options.scales.x.title.text = selectedMetricLabel;
				chart.options.scales.y.title.text = selectedPartyLabel;

				// 3. Update Tooltip Options (including callbacks)
				// Ensure the tooltip plugin options exist before assigning properties
				if (!chart.options.plugins.tooltip) {
					chart.options.plugins.tooltip = {}; // Initialize if needed
				}
				if (!chart.options.plugins.tooltip.callbacks) {
					chart.options.plugins.tooltip.callbacks = {}; // Initialize callbacks if needed
				}
				// Assign callbacks
				chart.options.plugins.tooltip.callbacks.title =
					tooltipTitleCallback;
				chart.options.plugins.tooltip.callbacks.label =
					tooltipLabelCallback;
				// Assign other tooltip properties directly from the prepared object
				// This ensures all styling aspects are updated consistently
				chart.options.plugins.tooltip.enabled = tooltipOptions.enabled;
				chart.options.plugins.tooltip.backgroundColor =
					tooltipOptions.backgroundColor;
				chart.options.plugins.tooltip.titleColor =
					tooltipOptions.titleColor;
				chart.options.plugins.tooltip.bodyColor =
					tooltipOptions.bodyColor;
				chart.options.plugins.tooltip.borderColor =
					tooltipOptions.borderColor;
				chart.options.plugins.tooltip.borderWidth =
					tooltipOptions.borderWidth;
				chart.options.plugins.tooltip.padding = tooltipOptions.padding;
				chart.options.plugins.tooltip.cornerRadius =
					tooltipOptions.cornerRadius;
				chart.options.plugins.tooltip.displayColors =
					tooltipOptions.displayColors;
				chart.options.plugins.tooltip.titleFont = {
					...tooltipOptions.titleFont,
				}; // Clone font objects
				chart.options.plugins.tooltip.bodyFont = {
					...tooltipOptions.bodyFont,
				}; // Clone font objects
				chart.options.plugins.tooltip.filter = tooltipOptions.filter;

				// 4. Update Tick Formatting Callbacks
				// Ensure scales and ticks objects exist before assigning callbacks
				if (chart.options.scales?.x?.ticks) {
					chart.options.scales.x.ticks.callback = formatXAxisTick;
				}
				if (chart.options.scales?.y?.ticks) {
					chart.options.scales.y.ticks.callback = formatYAxisTick;
				}

				// 5. Update Font Sizes (using a safe helper function)
				const updateFontSize = (
					optionPath: string[],
					newSize: number
				) => {
					let currentOption = chart.options as any; // Use 'any' for easier traversal or create a deep type
					try {
						for (let i = 0; i < optionPath.length - 1; i++) {
							if (!currentOption[optionPath[i]]) {
								// console.warn(`Path ${optionPath.slice(0, i + 1).join('.')} does not exist in chart options.`);
								return; // Path doesn't exist, cannot update
							}
							currentOption = currentOption[optionPath[i]];
						}
						const finalKey = optionPath[optionPath.length - 1];
						if (
							currentOption[finalKey] &&
							currentOption[finalKey].size !== newSize
						) {
							currentOption[finalKey].size = newSize;
						} else if (!currentOption[finalKey]) {
							// console.warn(`Property ${finalKey} does not exist at path ${optionPath.join('.')}.`);
						}
					} catch (e) {
						console.warn(
							"Error updating font size for path:",
							optionPath,
							e
						);
					}
				};

				// Update all relevant font sizes
				updateFontSize(
					["plugins", "title", "font"],
					fontSizes.titleSize
				);
				updateFontSize(
					["scales", "x", "title", "font"],
					fontSizes.axisTitleSize
				);
				updateFontSize(
					["scales", "y", "title", "font"],
					fontSizes.axisTitleSize
				);
				updateFontSize(
					["scales", "x", "ticks", "font"],
					fontSizes.tickSize
				);
				updateFontSize(
					["scales", "y", "ticks", "font"],
					fontSizes.tickSize
				);
				// Tooltip fonts are updated via the tooltipOptions assignment above

				// 6. Apply the updates to the chart
				chart.update("none"); // Update chart without re-animating

				// 7. Re-apply highlight state (important after data/options update)
				applyHighlight();
			} else {
				// Create new chart instance
				const ctx = canvas.getContext("2d");
				if (!ctx) throw new Error("Could not get canvas context.");

				chart = new window.Chart(ctx, {
					type: "scatter",
					data: { datasets }, // Pass datasets array
					options: {
						responsive: true,
						maintainAspectRatio: false,
						animation: false, // Disable initial animation
						layout: {
							padding: compact
								? { top: 5, right: 5, bottom: 5, left: 0 }
								: { top: 10, right: 15, bottom: 5, left: 5 },
						},
						interaction: {
							mode: "nearest",
							intersect: false,
							axis: "xy",
						},
						plugins: {
							legend: { display: false },
							// *** USE TOOLTIP OPTIONS HERE ***
							tooltip: tooltipOptions,
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
										weight: "normal",
									},
									color: "#4B5563",
									padding: { top: compact ? 4 : 8 },
								},
								grid: {
									color: "#E5E7EB",
									drawBorder: false,
								},
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
										weight: "normal",
									},
									color: "#4B5563",
									padding: { bottom: compact ? 4 : 8 },
								},
								grid: {
									color: "#E5E7EB",
									drawBorder: false,
								},
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
							// ... (onClick logic remains the same) ...
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
							}
						},
					},
				});
				applyHighlight(); // Apply initial highlight state
			}

			// Update complete
			isLoading = false;
		} catch (e: any) {
			// ... (error handling remains the same) ...
			console.error("Scatter: Chart update error:", e);
			errorMessage = `Chart Error: ${e.message}`;
			isLoading = false;
			pearsonR = null;
			rSquared = null;
			n = 0;
			currentPlotPoints = [];
			currentTooltipLabels = [];
			if (chart) {
				chart.destroy();
				chart = null;
			}
		}
	}

	// --- Resize handler ---
	const handleResize = debounce(() => {
		if (!chart || !chartContainer || !isMounted || !window.Chart) return;
		const newWidth = chartContainer.clientWidth;
		if (newWidth === 0) return; // Avoid updates if container is hidden

		const newFontSizes = getResponsiveFontSizes(newWidth);
		let optionsChanged = false;

		// Helper to update font size if needed
		const updateFontSize = (optionPath: string[], newSize: number) => {
			let currentOption = chart.options;
			for (let i = 0; i < optionPath.length - 1; i++) {
				if (!currentOption[optionPath[i]]) return; // Path doesn't exist
				currentOption = currentOption[optionPath[i]];
			}
			const finalKey = optionPath[optionPath.length - 1];
			if (
				currentOption[finalKey] &&
				currentOption[finalKey].size !== newSize
			) {
				currentOption[finalKey].size = newSize;
				optionsChanged = true;
			}
		};

		// Update all relevant font sizes
		updateFontSize(["plugins", "title", "font"], newFontSizes.titleSize);
		updateFontSize(
			["scales", "x", "title", "font"],
			newFontSizes.axisTitleSize
		);
		updateFontSize(
			["scales", "y", "title", "font"],
			newFontSizes.axisTitleSize
		);
		updateFontSize(["scales", "x", "ticks", "font"], newFontSizes.tickSize);
		updateFontSize(["scales", "y", "ticks", "font"], newFontSizes.tickSize);
		updateFontSize(
			["plugins", "tooltip", "titleFont"],
			newFontSizes.tooltipTitleSize
		);
		updateFontSize(
			["plugins", "tooltip", "bodyFont"],
			newFontSizes.tooltipBodySize
		);

		// Update chart if any font size changed
		if (optionsChanged) {
			chart.update("none"); // Update without animation
		}
		// Chart.js v4 handles resize automatically, but we might need this if maintainAspectRatio: false
		// chart.resize();
	}, 150); // Debounce resize events

	// --- Lifecycle ---
	onMount(async () => {
		isMounted = true;
		isLoading = true; // Start in loading state
		errorMessage = null;

		try {
			await loadChartLibraries(); // Load Chart.js and simple-statistics
			await updateChart(); // Initial chart render

			// Set up resize observer
			resizeObserver = new ResizeObserver(handleResize);
			if (chartContainer) {
				resizeObserver.observe(chartContainer);
			}
		} catch (err: any) {
			console.error("Scatter: Initialization failed:", err);
			errorMessage = `Initialization Error: ${err.message}.`;
			isLoading = false; // Stop loading on init error
			isMounted = false; // Indicate mount failed
		}
	});

	onDestroy(() => {
		isMounted = false;
		// Clean up resize observer
		if (resizeObserver && chartContainer) {
			resizeObserver.unobserve(chartContainer);
		}
		resizeObserver = null;
		// Destroy chart instance
		if (chart) {
			chart.destroy();
			chart = null;
		}
		// Clear data arrays
		currentPlotPoints = [];
		currentTooltipLabels = [];
		console.log("Scatter: Destroyed.");
	});

	// --- Reactive updates based on PROP changes ---
	const debouncedUpdateChart = debounce(updateChart, 200); // Debounce updates

	$: if (
		isMounted && // Only run updates if mounted
		typeof window.Chart === "function" && // And libraries are loaded
		typeof ss?.linearRegression === "function"
	) {
		// Check if relevant props have actually changed
		if (
			selectedParty !== prevSelectedParty ||
			selectedMetric !== prevSelectedMetric ||
			data?.length !== prevDataLength // Check data length as a proxy for data change
			// Add deep comparison here if data content might change without length changing
		) {
			console.log("Scatter: Props changed, triggering update.");
			debouncedUpdateChart(); // Call the debounced update function
			// Update previous values *after* scheduling the update
			prevSelectedParty = selectedParty;
			prevSelectedMetric = selectedMetric;
			prevDataLength = data?.length ?? 0;
		}
	}

	// Apply highlight reactively and efficiently
	$: if (isMounted && chart && highlightedConstituency !== prevHighlight) {
		console.log("Scatter: Highlight changed, applying update.");
		applyHighlight(); // Call the specific highlight function
		prevHighlight = highlightedConstituency; // Update previous highlight value
	}
</script>

<!-- HTML Template -->
<div
	class="font-sans bg-white rounded-lg border border-gray-200/75 shadow-sm {compact
		? 'p-2'
		: 'p-3 sm:p-4'}"
>
	<!-- Chart Area Container -->
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
				? 'opacity-0 pointer-events-none' /* Hide and disable interaction when loading/error */
				: 'opacity-100'} transition-opacity duration-200"
			style="display: block;"
		></canvas>
		<!-- Placeholder is now a separate component, shown based on state -->
		{#if isLoading || errorMessage}
			<ChartPlaceholder
				{isLoading}
				{errorMessage}
				initialLoad={!isMounted && isLoading}
			/>
		{/if}
	</div>

	<!-- Stats Display Area -->
	<div
		class="py-1.5 text-center min-h-[28px] bg-gray-100/70 rounded border border-gray-200/60 mb-3"
	>
		<ChartStatistics {pearsonR} {rSquared} {n} {isLoading} />
	</div>

	<!-- Sources and Notes Section -->
	<ChartNotes {compact} />
</div>
