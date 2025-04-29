// src/lib/components/scatter/chartLogic.ts

import type {
	ChartConfiguration,
	ChartOptions,
	Point,
	TooltipCallbacks,
	FontSpec,
	ChartJSChart,
	ConstituencyData,
	MetricOption,
	PartyOption,
	SimpleStatistics,
} from "$lib/types";
// *** Import hexToRgba ***
import { getNumericValue, hexToRgba } from "$lib/utils";
import { getResponsiveFontSizes, formatChartLabel } from "./chartUtils";
import { metricQuintileColors, NO_DATA_COLOR } from "$lib/config";

// ProcessChartData and generateChartConfig functions remain the same...
export interface ProcessedChartData {
	plotPoints: (Point & { label: string; id: string })[];
	statPoints: [number, number][];
	pearsonR: number | null;
	rSquared: number | null;
	n: number;
	regressionLinePoints: Point[];
	metricQuantiles: number[];
	xValuesForQuantiles: number[];
}
export function processChartData(
	data: ConstituencyData[],
	selectedMetric: string,
	selectedParty: string,
	ss: SimpleStatistics
): ProcessedChartData {
	const plotPoints: ProcessedChartData["plotPoints"] = [];
	const statPoints: ProcessedChartData["statPoints"] = [];
	let pointsExcluded = 0;
	const isSwingMetricX = selectedMetric === "swing_con_lab_19_24";
	const isSwingMetricY = selectedParty === "swing_con_lab_19_24";
	for (const row of data) {
		const name = row.constituency_name!;
		const id = row.const_code!;
		const xVal = getNumericValue(row, selectedMetric);
		const yVal = getNumericValue(row, selectedParty);
		const yValueValid = yVal !== null && isFinite(yVal);
		const xValueValid = xVal !== null && isFinite(xVal);
		let isValidXForPlot: boolean;
		if (isSwingMetricX) {
			isValidXForPlot = xValueValid;
		} else {
			isValidXForPlot = xValueValid && xVal >= 0;
		}
		let isValidYForPlot: boolean;
		if (isSwingMetricY) {
			isValidYForPlot = yValueValid;
		} else {
			isValidYForPlot = yValueValid && yVal >= 0;
		}
		if (isValidXForPlot && isValidYForPlot) {
			plotPoints.push({ x: xVal!, y: yVal!, label: name, id: id });
			if (xValueValid && yValueValid) {
				statPoints.push([xVal!, yVal!]);
			}
		} else {
			pointsExcluded++;
		}
	}
	let pearsonR: number | null = null;
	let rSquared: number | null = null;
	let regressionLinePoints: Point[] = [];
	const n = statPoints.length;
	let xValuesForQuantiles: number[];
	if (isSwingMetricX) {
		xValuesForQuantiles = statPoints.map((p) => p[0]);
	} else {
		xValuesForQuantiles = statPoints.map((p) => p[0]).filter((x) => x > 0);
	}
	xValuesForQuantiles.sort((a, b) => a - b);
	let metricQuantiles: number[] = [];
	if (xValuesForQuantiles.length >= 5) {
		metricQuantiles = [20, 40, 60, 80].map((p) =>
			ss.quantile(xValuesForQuantiles, p / 100)
		);
	}
	if (n >= 5) {
		try {
			const xValues = statPoints.map((p) => p[0]);
			const yValues = statPoints.map((p) => p[1]);
			const xStdDev = ss.standardDeviation(xValues);
			const yStdDev = ss.standardDeviation(yValues);
			if (xStdDev > 0 && yStdDev > 0) {
				pearsonR = ss.sampleCorrelation(xValues, yValues);
				rSquared = pearsonR * pearsonR;
				const regression = ss.linearRegression(statPoints);
				const regressionFunction = ss.linearRegressionLine(regression);
				const xMin = ss.min(xValues);
				const xMax = ss.max(xValues);
				const numLinePoints = Math.max(2, Math.min(20, n));
				const xStep =
					numLinePoints > 1 && xMax > xMin
						? (xMax - xMin) / (numLinePoints - 1)
						: 0;
				for (let i = 0; i < numLinePoints; i++) {
					const x = xMin + i * xStep;
					const y = regressionFunction(x);
					if (isFinite(x) && isFinite(y)) {
						regressionLinePoints.push({ x, y });
					}
				}
				if (
					regressionLinePoints.length < 2 ||
					(regressionLinePoints.length === 2 &&
						regressionLinePoints[0].x ===
							regressionLinePoints[1].x &&
						regressionLinePoints[0].y === regressionLinePoints[1].y)
				) {
					regressionLinePoints = [];
				}
			}
		} catch (statError) {
			console.error(
				"Scatter: Error during statistical calculation:",
				statError
			);
			pearsonR = null;
			rSquared = null;
			regressionLinePoints = [];
		}
	}
	return {
		plotPoints,
		statPoints,
		pearsonR,
		rSquared,
		n,
		regressionLinePoints,
		metricQuantiles,
		xValuesForQuantiles,
	};
}
export function generateChartConfig(
	processedData: ProcessedChartData,
	props: {
		selectedParty: string;
		selectedMetric: string;
		metrics: MetricOption[];
		parties: PartyOption[];
		compact: boolean;
		containerWidth: number;
	},
	onPointClick: (name: string) => void
): ChartConfiguration<"scatter"> {
	const {
		plotPoints,
		regressionLinePoints,
		metricQuantiles,
		xValuesForQuantiles,
	} = processedData;
	const {
		selectedParty,
		selectedMetric,
		metrics,
		parties,
		compact,
		containerWidth,
	} = props;
	const isSwingMetricY = selectedParty === "swing_con_lab_19_24";
	const fontSizes = getResponsiveFontSizes(containerWidth);
	const selectedPartyLabel =
		parties.find((p) => p.value === selectedParty)?.label || selectedParty;
	const selectedMetricLabel =
		metrics.find((m) => m.value === selectedMetric)?.label ||
		selectedMetric;
	// --- Calculate INITIAL Point Colors (used by applyChartHighlight) ---
	// Store the base hex color for each point before applying opacity
	const baseHexColors = plotPoints.map((point) => {
		const value = point.x;
		const isSwingMetricX = selectedMetric === "swing_con_lab_19_24";
		if (value === null || value === undefined) return NO_DATA_COLOR;
		if (!isSwingMetricX && value === 0) return NO_DATA_COLOR;
		if (metricQuantiles.length < 4 || xValuesForQuantiles.length < 5) {
			if (
				xValuesForQuantiles.length < 2 ||
				xValuesForQuantiles[xValuesForQuantiles.length - 1] <=
					xValuesForQuantiles[0]
			) {
				return metricQuintileColors[2];
			} else {
				const min = xValuesForQuantiles[0];
				const max = xValuesForQuantiles[xValuesForQuantiles.length - 1];
				const ratio = Math.max(
					0,
					Math.min(1, (value - min) / (max - min))
				);
				const colorIndex = Math.max(
					0,
					Math.min(4, Math.floor(ratio * 5))
				);
				return metricQuintileColors[colorIndex];
			}
		} else {
			if (value < metricQuantiles[0]) return metricQuintileColors[0];
			if (value < metricQuantiles[1]) return metricQuintileColors[1];
			if (value < metricQuantiles[2]) return metricQuintileColors[2];
			if (value < metricQuantiles[3]) return metricQuintileColors[3];
			return metricQuintileColors[4];
		}
	});
	// Initial background colors apply base opacity
	const initialBackgroundColors = baseHexColors.map((hex) =>
		hexToRgba(hex, 1)
	);

	const defaultPointSize = compact ? 2.5 : 3;
	const pointHoverSize = compact ? 5 : 6;
	const datasets: ChartConfiguration<"scatter">["data"]["datasets"] = [
		{
			label: "Constituencies",
			data: plotPoints,
			parsing: false,
			// *** Use initial colors with base opacity ***
			backgroundColor: initialBackgroundColors,
			// Store base hex colors for reference in applyChartHighlight
			_baseHexColors: baseHexColors,
			borderColor: "transparent",
			borderWidth: 0,
			pointRadius: defaultPointSize,
			pointHoverRadius: pointHoverSize,
			pointHitRadius: compact ? 8 : 10,
			pointHoverBorderWidth: 1.5,
			pointHoverBackgroundColor: (context: any) =>
				context.dataset.backgroundColor[context.dataIndex],
			pointHoverBorderColor: "#000000",
			order: 1,
		},
	];
	if (regressionLinePoints.length > 1) {
		datasets.push({
			type: "line",
			label: "Trend",
			data: regressionLinePoints,
			parsing: false,
			backgroundColor: "transparent",
			borderColor: "rgba(0, 0, 0, 0.4)",
			borderWidth: 1.5,
			borderDash: [4, 4],
			pointRadius: 0,
			fill: false,
			tension: 0.1,
			order: 0,
			pointHitRadius: 0,
			pointHoverRadius: 0,
		});
	}
	const tooltipCallbacks: Partial<TooltipCallbacks<"scatter">> = {
		title: (tooltipItems: any[]) => {
			const item = tooltipItems[0];
			return item?.raw?.label ?? "";
		},
		label: (context: any) => {
			const point = context.raw as Point & { label: string; id: string };
			if (!point) return null;
			const xFormatted = formatChartLabel(point.x, selectedMetricLabel);
			const yFormatted = formatChartLabel(point.y, selectedPartyLabel);
			return [
				`${selectedMetricLabel.split("(")[0].trim()}: ${xFormatted}`,
				`${selectedPartyLabel.split("(")[0].trim()}: ${yFormatted}`,
			];
		},
	};
	const options: ChartOptions<"scatter"> = {
		responsive: true,
		maintainAspectRatio: false,
		animation: false,
		layout: {
			padding: compact
				? { top: 4, right: 4, bottom: 4, left: 0 }
				: { top: 8, right: 10, bottom: 5, left: 5 },
		},
		interaction: { mode: "nearest", axis: "xy", intersect: true },
		plugins: {
			legend: { display: false },
			tooltip: {
				enabled: true,
				backgroundColor: "rgba(0, 0, 0, 0.85)",
				titleColor: "#ffffff",
				bodyColor: "#e5e7eb",
				borderColor: "transparent",
				borderWidth: 0,
				padding: compact ? 6 : 8,
				cornerRadius: 4,
				displayColors: false,
				titleFont: {
					weight: "600",
					size: fontSizes.tooltipTitleSize,
				} as Partial<FontSpec>,
				bodyFont: {
					size: fontSizes.tooltipBodySize,
				} as Partial<FontSpec>,
				callbacks: tooltipCallbacks,
				filter: (tooltipItem: any) => tooltipItem.datasetIndex === 0,
			},
			title: {
				display: !compact,
				text: `${selectedPartyLabel} vs ${selectedMetricLabel}`,
				align: "start",
				padding: { top: 0, bottom: compact ? 10 : 15 },
				font: {
					size: fontSizes.titleSize,
					weight: "500",
					family: "Inter var, Inter, sans-serif",
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
						family: "Inter var, Inter, sans-serif",
						weight: "normal",
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
					callback: (value) =>
						formatChartLabel(Number(value), selectedMetricLabel),
				},
			},
			y: {
				type: "linear",
				position: "left",
				beginAtZero: !isSwingMetricY,
				title: {
					display: true,
					text: selectedPartyLabel,
					font: {
						size: fontSizes.axisTitleSize,
						family: "Inter var, Inter, sans-serif",
						weight: "normal",
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
					callback: (value) =>
						formatChartLabel(Number(value), selectedPartyLabel),
				},
			},
		},
		onClick: (_event: MouseEvent, elements: any[]) => {
			if (!elements || elements.length === 0) return;
			const element = elements.find((el) => el.datasetIndex === 0);
			if (element) {
				const index = element.index;
				if (
					index !== undefined &&
					index >= 0 &&
					index < plotPoints.length
				) {
					onPointClick(plotPoints[index].label);
				}
			}
		},
	};
	return { type: "scatter", data: { datasets }, options: options };
}

/**
 * Applies highlight styling (point size, border, opacity) to the chart dataset.
 * Modifies the dataset directly.
 */
export function applyChartHighlight(
	dataset: any, // Use any temporarily as we added a custom prop
	plotPoints: ProcessedChartData["plotPoints"],
	highlightedConstituency: string | null,
	compact: boolean
) {
	if (
		!dataset ||
		!plotPoints ||
		!Array.isArray(dataset.data) ||
		!dataset._baseHexColors
	) {
		console.warn("ApplyChartHighlight: prerequisites not met.");
		return;
	}

	const defaultPointSize = compact ? 2.5 : 3;
	const highlightedPointSize = compact ? 7 : 8;
	const highlightBorderColor = "#000000"; // Black outline
	const highlightBorderWidth = 3;

	// Define opacities
	const baseOpacity = 1;
	const dimmedOpacity = 0.2;
	const highlightedOpacity = 1;

	try {
		// Update point styles based on highlight
		dataset.pointRadius = plotPoints.map((p) =>
			p.label === highlightedConstituency
				? highlightedPointSize
				: defaultPointSize
		);
		dataset.borderColor = plotPoints.map((p) =>
			p.label === highlightedConstituency
				? highlightBorderColor
				: "transparent"
		);
		dataset.borderWidth = plotPoints.map((p) =>
			p.label === highlightedConstituency ? highlightBorderWidth : 0
		);

		// *** Update background colors with opacity ***
		dataset.backgroundColor = plotPoints.map((p, index) => {
			const baseHex = dataset._baseHexColors[index] || NO_DATA_COLOR; // Fallback
			if (highlightedConstituency === null) {
				// Nothing highlighted, use base opacity
				return hexToRgba(baseHex, baseOpacity);
			} else {
				// Something is highlighted
				return p.label === highlightedConstituency
					? hexToRgba(baseHex, highlightedOpacity) // Highlighted point opacity
					: hexToRgba(baseHex, dimmedOpacity); // Dimmed point opacity
			}
		});
	} catch (e) {
		console.error("Error applying chart highlight styles:", e);
		// Reset to defaults in case of error
		dataset.pointRadius = defaultPointSize;
		dataset.borderColor = "transparent";
		dataset.borderWidth = 0;
		// Reset background colors to base opacity
		dataset.backgroundColor = dataset._baseHexColors.map((hex: string) =>
			hexToRgba(hex, baseOpacity)
		);
	}
}
