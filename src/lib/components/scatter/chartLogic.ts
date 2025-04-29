import type {
	ChartConfiguration,
	ChartOptions,
	Point,
	TooltipCallbacks,
	FontSpec,
} from "chart.js";
import type { ConstituencyData, MetricOption, PartyOption } from "./types";
import { getNumericValue } from "./utils";
import { getResponsiveFontSizes, formatLegendLabel } from "./ChartUtils";
// Import map constants for colors (Orange-Yellow-Blue scheme)
import {
	metricQuintileColors,
	NO_DATA_COLOR,
} from "$lib/components/map/MapConstants";

// Define types for simple-statistics if not using global window.ss
type SimpleStatistics = typeof import("simple-statistics");

export interface ProcessedChartData {
	plotPoints: (Point & { label: string; id: string })[]; // Points actually plotted
	statPoints: [number, number][]; // Points used for statistical calculations
	pearsonR: number | null;
	rSquared: number | null;
	n: number; // Number of points used for stats
	regressionLinePoints: Point[];
	metricQuantiles: number[]; // Quantiles based on the selected metric (X-axis)
	xValuesForQuantiles: number[]; // Values used for quantile calculation
}

/**
 * Processes raw constituency data into formats needed for chart plotting and statistics.
 */
export function processChartData(
	data: ConstituencyData[],
	selectedMetric: string, // Variable for X-axis
	selectedParty: string, // Variable for Y-axis (can be party or swing)
	ss: SimpleStatistics // Pass ss library instance
): ProcessedChartData {
	const plotPoints: (Point & { label: string; id: string })[] = [];
	const statPoints: [number, number][] = []; // Separate array for stats points
	const sortedData = [...data].sort((a, b) =>
		(a.const_code ?? "").localeCompare(b.const_code ?? "")
	);
	let pointsExcluded = 0;

	const isSwingMetricX = selectedMetric === "swing_con_lab_19_24";
	const isSwingMetricY = selectedParty === "swing_con_lab_19_24"; // Check if Y-axis is swing

	for (const row of sortedData) {
		const xVal = getNumericValue(row, selectedMetric);
		const yVal = getNumericValue(row, selectedParty);
		const name = row.constituency_name;
		const id = row.const_code;

		// --- Filtering Logic ---
		// Basic validity checks first
		const hasIdentifiers = name && id;
		const yValueValid = yVal !== null && isFinite(yVal);
		const xValueValid = xVal !== null && isFinite(xVal);

		// Determine validity for plotting based on metric type
		let isValidXForPlot: boolean;
		if (isSwingMetricX) {
			// Allow any finite number (positive, negative, zero) for swing plot on X
			isValidXForPlot = xValueValid;
		} else {
			// For other metrics on X, require non-negative
			isValidXForPlot = xValueValid && xVal >= 0;
		}

		// Determine Y validity for plotting
		let isValidYForPlot: boolean;
		if (isSwingMetricY) {
			// Allow any finite number (positive, negative, zero) for swing plot on Y
			isValidYForPlot = yValueValid;
		} else {
			// Require positive Y for voteshare
			isValidYForPlot = yValueValid && yVal > 0;
		}
		// --- End Filtering ---

		if (isValidXForPlot && isValidYForPlot && hasIdentifiers) {
			plotPoints.push({ x: xVal!, y: yVal!, label: name!, id: id! }); // Use non-null assertion after checks
			// Include in stats points if both are valid numbers
			if (xValueValid && yValueValid) {
				// Use non-null assertion after checks
				statPoints.push([xVal!, yVal!]);
			}
		} else {
			pointsExcluded++;
		}
	}
	if (pointsExcluded > 0) {
		console.warn(
			`Scatter: Excluded ${pointsExcluded} points due to invalid/missing X/Y values or identifiers based on plot criteria for ${selectedMetric} vs ${selectedParty}.`
		);
	}
	if (plotPoints.length === 0 && data.length > 0) {
		console.error(
			`Scatter: No valid plot points generated for metric '${selectedMetric}' and party '${selectedParty}'. Check data and filtering.`
		);
	}

	// --- Statistical Calculations (Using statPoints) ---
	let pearsonR: number | null = null;
	let rSquared: number | null = null;
	let regressionLinePoints: Point[] = [];
	const n = statPoints.length; // Number of points used for stats

	// --- Calculate Metric (X-axis) Quantiles ---
	let xValuesForQuantiles: number[];
	if (isSwingMetricX) {
		// For swing on X, calculate quantiles across the whole range
		xValuesForQuantiles = statPoints.map((p) => p[0]);
	} else {
		// For other metrics on X, exclude 0 from quantile calculation range if desired
		xValuesForQuantiles = statPoints.map((p) => p[0]).filter((x) => x > 0);
	}
	xValuesForQuantiles.sort((a, b) => a - b);
	let metricQuantiles: number[] = [];
	if (xValuesForQuantiles.length >= 5) {
		const p = (percent: number) => {
			const index = Math.max(
				0,
				Math.min(
					xValuesForQuantiles.length - 1,
					Math.floor(
						(percent / 100) * (xValuesForQuantiles.length - 1)
					)
				)
			);
			return xValuesForQuantiles[index];
		};
		metricQuantiles = [p(20), p(40), p(60), p(80)];
	}
	// --- End Quantile Calculation ---

	// --- Regression Calculation ---
	if (n >= 5) {
		// Use 'n' (count of points valid for stats)
		try {
			const xValues = statPoints.map((p) => p[0]);
			const yValues = statPoints.map((p) => p[1]);
			const xStdDev = ss.standardDeviation(xValues);
			const yStdDev = ss.standardDeviation(yValues);

			// Check for variance before calculating correlation/regression
			if (xStdDev > 0 && yStdDev > 0) {
				const regression = ss.linearRegression(statPoints);
				const regressionFunction = ss.linearRegressionLine(regression);
				pearsonR = ss.sampleCorrelation(xValues, yValues);
				rSquared = pearsonR * pearsonR;

				// Generate regression line points across the observed range of X values used in stats
				const xMin = ss.min(xValues);
				const xMax = ss.max(xValues);
				const numPoints = 20;
				const xStep =
					numPoints > 1 && xMax > xMin
						? (xMax - xMin) / (numPoints - 1)
						: 0;

				for (let i = 0; i < numPoints; i++) {
					const x = xMin + i * xStep;
					const y = regressionFunction(x);
					if (isFinite(x) && isFinite(y)) {
						regressionLinePoints.push({ x, y });
					}
				}
				if (regressionLinePoints.length < 2) regressionLinePoints = []; // Need at least 2 points for a line
			} else {
				console.warn(
					"Scatter: Cannot calculate correlation/regression with constant X or Y values."
				);
			}
		} catch (statError) {
			console.error(
				"Scatter: Error during statistical calculation:",
				statError
			);
			pearsonR = null;
			rSquared = null;
			regressionLinePoints = []; // Reset on error
		}
	} else if (n > 0) {
		// Log only if there were *some* points but not enough
		console.warn(
			`Scatter: Not enough valid data points (${n}) for correlation.`
		);
	}

	return {
		plotPoints, // Points actually plotted
		statPoints, // Points used for stats
		pearsonR,
		rSquared,
		n, // Count of points used for stats
		regressionLinePoints,
		metricQuantiles, // Quantiles based on X-axis
		xValuesForQuantiles, // Values used for X-axis quantiles
	};
}

/**
 * Generates the Chart.js configuration object based on processed data and props.
 */
export function generateChartConfig(
	processedData: ProcessedChartData,
	props: {
		selectedParty: string; // Y-axis variable (party or swing)
		selectedMetric: string; // X-axis variable
		metrics: MetricOption[];
		parties: PartyOption[];
		partyColors: { [key: string]: string };
		title: string;
		compact: boolean;
		containerWidth: number;
	},
	onPointClick: (name: string) => void
): ChartConfiguration<"scatter"> {
	// Specify chart type for better typing

	const {
		plotPoints,
		regressionLinePoints,
		metricQuantiles,
		xValuesForQuantiles,
	} = processedData; // Get quantiles for X-axis metric
	const {
		selectedParty,
		selectedMetric,
		metrics,
		parties,
		partyColors, // Still needed for potential hover effects or fallbacks if desired
		title,
		compact,
		containerWidth,
	} = props;

	// --- Font Size Calculation with Safety ---
	const validContainerWidth = Math.max(containerWidth || 0, 1);
	let fontSizes = getResponsiveFontSizes(validContainerWidth);
	if (
		!fontSizes ||
		typeof fontSizes.tooltipBodySize !== "number" ||
		typeof fontSizes.tooltipTitleSize !== "number"
	) {
		console.warn(
			"generateChartConfig: Invalid fontSizes calculated, using defaults."
		);
		fontSizes = {
			titleSize: compact ? 14 : 16,
			axisTitleSize: compact ? 11 : 12,
			tickSize: compact ? 9 : 10,
			tooltipTitleSize: compact ? 11 : 13,
			tooltipBodySize: compact ? 10 : 11,
		};
	}
	// --- End Font Size Calculation ---

	// Get labels for axes
	const selectedPartyLabel =
		parties.find((p) => p.value === selectedParty)?.label || selectedParty;
	const selectedMetricLabel =
		metrics.find((m) => m.value === selectedMetric)?.label ||
		selectedMetric;

	// --- Calculate Point Colors based on Metric (X-value) ---
	const pointBackgroundColors = plotPoints.map((point) => {
		const value = point.x; // Use the metric value (X)
		const isSwingMetricX = selectedMetric === "swing_con_lab_19_24";

		// Apply NO_DATA_COLOR only if value is strictly null/undefined? Or keep 0 as NO_DATA?
		// Let's keep 0 as NO_DATA for non-swing metrics for visual consistency with map
		if (!isSwingMetricX && value === 0) return NO_DATA_COLOR;
		// If value is null/undefined (shouldn't happen due to plotPoints filter, but safe check)
		if (value === null || value === undefined) return NO_DATA_COLOR;

		// Handle case with insufficient data for quantiles
		if (metricQuantiles.length < 4) {
			if (
				xValuesForQuantiles.length < 2 ||
				xValuesForQuantiles[xValuesForQuantiles.length - 1] <=
					xValuesForQuantiles[0]
			) {
				return metricQuintileColors[2]; // Middle color if no range or too few points
			} else {
				// Basic interpolation logic (similar to map)
				const min = xValuesForQuantiles[0];
				const max = xValuesForQuantiles[xValuesForQuantiles.length - 1];
				const ratio = Math.max(
					0,
					Math.min(1, (value - min) / (max - min))
				);
				const colorIndex = Math.min(4, Math.floor(ratio * 5));
				return metricQuintileColors[colorIndex];
			}
		} else {
			// Use calculated quantiles
			if (value < metricQuantiles[0]) return metricQuintileColors[0];
			if (value < metricQuantiles[1]) return metricQuintileColors[1];
			if (value < metricQuantiles[2]) return metricQuintileColors[2];
			if (value < metricQuantiles[3]) return metricQuintileColors[3];
			return metricQuintileColors[4]; // Includes values >= quintiles[3]
		}
	});
	// --- End Point Color Calculation ---

	const defaultPointSize = compact ? 2.5 : 3;
	const pointSizes = plotPoints.map(() => defaultPointSize);
	const pointBorderColors = plotPoints.map(() => "transparent");
	const pointBorderWidths = plotPoints.map(() => 0);

	const datasets: ChartConfiguration<"scatter">["data"]["datasets"] = [
		{
			label: "Constituencies",
			data: plotPoints, // Pass full objects
			parsing: { xAxisKey: "x", yAxisKey: "y" },
			backgroundColor: pointBackgroundColors, // Use the calculated color array based on X-metric
			borderColor: pointBorderColors, // Initial state, highlight updates separately
			borderWidth: pointBorderWidths, // Initial state
			pointRadius: pointSizes, // Initial state
			pointHoverRadius: compact ? 5 : 6,
			pointHitRadius: compact ? 8 : 10,
			pointHoverBorderWidth: 1.5,
			pointHoverBackgroundColor: pointBackgroundColors, // Keep original color on hover
			pointHoverBorderColor: "#000000", // Use black border on hover
			order: 1,
		},
	];

	if (regressionLinePoints.length > 1) {
		datasets.push({
			type: "line", // Specify type for mixed chart
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
			pointHitRadius: 0,
			pointHoverRadius: 0,
			hitRadius: 0,
			hoverRadius: 0, // Non-interactive
		});
	}

	const chartTitleText =
		title || `${selectedPartyLabel} vs ${selectedMetricLabel}`;

	// --- Formatters ---
	const formatXAxisTick = (value: number | string): string => {
		const numValue = Number(value);
		if (isNaN(numValue)) return String(value);
		return formatLegendLabel(numValue, selectedMetricLabel);
	};
	const formatYAxisTick = (value: number | string): string => {
		const numValue = Number(value);
		if (isNaN(numValue)) return String(value);
		// Check if the Y-axis variable is swing
		if (selectedParty === "swing_con_lab_19_24") {
			return `${numValue.toFixed(1)}%`; // Show swing with one decimal and %
		} else {
			// Assume other Y-axis variables are standard percentages
			return `${numValue.toFixed(0)}%`;
		}
	};

	// --- Tooltip Callbacks (Restored Style) ---
	const tooltipCallbacks: Partial<TooltipCallbacks<"scatter">> = {
		title: (tooltipItems: any[]) => {
			// Title is Constituency Name
			if (tooltipItems.length > 0) {
				const item = tooltipItems[0];
				const index = item.dataIndex;
				if (
					item.datasetIndex === 0 &&
					index >= 0 &&
					index < plotPoints.length
				) {
					return plotPoints[index].label;
				}
			}
			return "";
		},
		label: (context: any) => {
			// Body lines are Metric and Party/Swing
			const index = context.dataIndex;
			if (
				context.datasetIndex === 0 &&
				index >= 0 &&
				index < plotPoints.length
			) {
				const point = plotPoints[index];
				const xFormatted = formatLegendLabel(
					point.x,
					selectedMetricLabel
				);
				// Use formatLegendLabel for Y value for consistency (handles % sign)
				const yFormatted = formatLegendLabel(
					point.y,
					selectedPartyLabel
				);
				return [
					`${selectedMetricLabel
						.split("(")[0]
						.trim()}: ${xFormatted}`,
					`${selectedPartyLabel.split("(")[0].trim()}: ${yFormatted}`,
				];
			}
			return null; // Return null if not applicable
		},
	};

	// --- Chart Options ---
	const options: ChartOptions<"scatter"> = {
		// Add type annotation
		responsive: true,
		maintainAspectRatio: false,
		animation: false, // NO ANIMATION
		layout: {
			padding: compact
				? { top: 5, right: 5, bottom: 5, left: 0 }
				: { top: 10, right: 15, bottom: 5, left: 5 },
		},
		interaction: {
			mode: "nearest",
			axis: "xy",
			// *** Require direct intersection for tooltip ***
			intersect: true,
		},
		plugins: {
			legend: { display: false },
			tooltip: {
				enabled: true,
				// Restore previous style matching map tooltip
				backgroundColor: "rgba(0, 0, 0, 0.85)",
				titleColor: "#ffffff", // White title
				bodyColor: "#d1d5db", // Lighter grey body
				borderColor: "transparent",
				borderWidth: 0,
				padding: compact ? 6 : 8,
				cornerRadius: 4,
				displayColors: false, // Hide color boxes
				// Use distinct title and body font sizes again
				titleFont: {
					weight: "bold",
					size: fontSizes.tooltipTitleSize, // Use specific title size
				} as Partial<FontSpec>,
				bodyFont: {
					size: fontSizes.tooltipBodySize, // Use specific body size
				} as Partial<FontSpec>,
				callbacks: tooltipCallbacks, // Assign the restored callbacks
				filter: (tooltipItem: any) => tooltipItem.datasetIndex === 0,
			},
			title: {
				display: !compact && !!chartTitleText,
				text: chartTitleText,
				align: "start",
				padding: { top: 0, bottom: compact ? 10 : 15 },
				font: {
					size: fontSizes.titleSize, // Use checked/defaulted fontSizes
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
						size: fontSizes.axisTitleSize, // Use checked/defaulted fontSizes
						family: "system-ui, sans-serif",
						weight: "normal",
					},
					color: "#4B5563",
					padding: { top: compact ? 4 : 8 },
				},
				grid: { color: "#E5E7EB", drawBorder: false },
				ticks: {
					color: "#6B7280",
					font: { size: fontSizes.tickSize }, // Use checked/defaulted fontSizes
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
						size: fontSizes.axisTitleSize, // Use checked/defaulted fontSizes
						family: "system-ui, sans-serif",
						weight: "normal",
					},
					color: "#4B5563",
					padding: { bottom: compact ? 4 : 8 },
				},
				grid: { color: "#E5E7EB", drawBorder: false },
				ticks: {
					color: "#6B7280",
					font: { size: fontSizes.tickSize }, // Use checked/defaulted fontSizes
					maxTicksLimit: compact ? 4 : 6,
					padding: 5,
					callback: formatYAxisTick,
				},
			},
		},
		onClick: (_event: MouseEvent, elements: any[]) => {
			if (!elements || elements.length === 0) return;
			const element = elements[0];
			if (element.datasetIndex === 0) {
				const index = element.index;
				// Use plotPoints array for safety check
				if (
					index !== undefined &&
					index >= 0 &&
					index < plotPoints.length
				) {
					onPointClick(plotPoints[index].label); // Use the callback
				}
			}
		},
	};

	return {
		type: "scatter", // Base type
		data: { datasets },
		options: options,
	};
}

/**
 * Applies highlight styling.
 */
export function applyChartHighlight(
	dataset:
		| ChartConfiguration<"scatter">["data"]["datasets"][0]
		| null
		| undefined,
	plotPoints: ProcessedChartData["plotPoints"],
	highlightedConstituency: string | null,
	compact: boolean
) {
	if (!dataset || !plotPoints || plotPoints.length === 0) return;
	const defaultPointSize = compact ? 2.5 : 3;
	const highlightedPointSize = compact ? 5 : 6;
	const highlightBorderColor = "#1D4ED8";
	try {
		const radii = plotPoints.map((p) =>
			p.label === highlightedConstituency
				? highlightedPointSize
				: defaultPointSize
		);
		const borderColors = plotPoints.map((p) =>
			p.label === highlightedConstituency
				? highlightBorderColor
				: "transparent"
		);
		const borderWidths = plotPoints.map((p) =>
			p.label === highlightedConstituency ? 1.5 : 0
		);
		dataset.pointRadius = radii;
		dataset.borderColor = borderColors;
		dataset.borderWidth = borderWidths;
	} catch (e) {
		console.error("Error preparing highlight styles:", e);
	}
}
