import type { Map as MaplibreMap, MapDataEvent } from "maplibre-gl";
import { getNumericValue } from "$lib/components/scatter/utils";
import type { ConstituencyData } from "$lib/components/scatter/types";
import {
	SOURCE_LAYER,
	FEATURE_ID_PROPERTY,
	NO_DATA_COLOR,
	partyQuintileColors,
	metricQuintileColors,
} from "./MapConstants";

/**
 * Adds the initial source and layers (fill + highlight outline) to a map instance.
 */
export async function addInitialSourceAndLayers(
	mapInstance: MaplibreMap,
	sourceId: string,
	baseFillLayerId: string,
	baseHighlightLayerId: string
): Promise<void> {
	return new Promise((resolve, reject) => {
		try {
			// Add Source (if needed)
			if (!mapInstance.getSource(sourceId)) {
				mapInstance.addSource(sourceId, {
					type: "vector",
					tiles: [
						"https://map.jacobweinbren.workers.dev/gb-constituencies/{z}/{x}/{y}.mvt",
					],
					promoteId: FEATURE_ID_PROPERTY,
					minzoom: 0,
					maxzoom: 17,
				});

				const checkSourceLoaded = (e: MapDataEvent) => {
					if (e.sourceId === sourceId && e.isSourceLoaded) {
						mapInstance.off("sourcedata", checkSourceLoaded);
						addInitialLayers();
					}
				};
				mapInstance.on("sourcedata", checkSourceLoaded);

				if (mapInstance.isSourceLoaded(sourceId)) {
					// Check immediate load
					mapInstance.off("sourcedata", checkSourceLoaded);
					addInitialLayers();
				}
			} else {
				addInitialLayers(); // Source exists, just add layers
			}

			function addInitialLayers() {
				// Add Initial Highlight Layer (if needed)
				if (!mapInstance.getLayer(baseHighlightLayerId)) {
					mapInstance.addLayer({
						id: baseHighlightLayerId,
						type: "line",
						source: sourceId,
						"source-layer": SOURCE_LAYER,
						paint: {
							"line-color": "#000000",
							"line-width": 2.5,
							"line-opacity": 0, // Initially hidden
						},
						filter: ["==", FEATURE_ID_PROPERTY, ""],
					});
					console.log(`Added initial layer: ${baseHighlightLayerId}`);
				}

				// Add Initial Fill Layer (if needed), before the highlight layer
				if (!mapInstance.getLayer(baseFillLayerId)) {
					mapInstance.addLayer(
						{
							id: baseFillLayerId,
							type: "fill",
							source: sourceId,
							"source-layer": SOURCE_LAYER,
							paint: {
								"fill-color": NO_DATA_COLOR,
								"fill-opacity": 0.75, // Start visible
								"fill-outline-color": "rgba(0,0,0,0.1)",
							},
						},
						baseHighlightLayerId // Add before highlight
					);
					console.log(`Added initial layer: ${baseFillLayerId}`);
				}
				resolve(); // Layers are added or already exist
			}

			// Safety timeout
			setTimeout(() => {
				if (!mapInstance.getSource(sourceId)) {
					reject(
						new Error(
							`Source ${sourceId} failed to load within timeout`
						)
					);
				} else if (
					!mapInstance.getLayer(baseFillLayerId) ||
					!mapInstance.getLayer(baseHighlightLayerId)
				) {
					console.warn(
						`Adding initial layers for ${baseFillLayerId} via timeout fallback`
					);
					addInitialLayers(); // Attempt to add layers anyway
				} else {
					resolve(); // Layers might have been added by the event listener
				}
			}, 5000);
		} catch (error) {
			console.error(
				`Critical error adding source/initial layers for ${baseFillLayerId}:`,
				error
			);
			reject(error);
		}
	});
}

/**
 * Updates the paint properties (fill-color, highlight filter/opacity) for map layers.
 * No animation is applied here.
 */
export function updateMapPaintProperties(
	mapInstance: MaplibreMap | null,
	layerId: string,
	highlightLayerId: string,
	sourceId: string, // Needed for querying features
	variableType: "party" | "metric",
	variableKey: string,
	data: ConstituencyData[],
	highlightedConstituency: string | null
) {
	if (
		!mapInstance ||
		!mapInstance.isStyleLoaded() ||
		!mapInstance.getLayer(layerId) ||
		!mapInstance.getLayer(highlightLayerId)
	) {
		// console.warn(`Map/Layers not ready for paint update on ${layerId}`);
		return;
	}

	// --- Calculate Color Expression ---
	const values: number[] = [];
	const codeToValue: { [code: string]: number } = {}; // Map code directly to value

	data.forEach((d) => {
		const code = d.const_code;
		const value = getNumericValue(d, variableKey);
		if (code && value !== null && isFinite(value) && value >= 0) {
			codeToValue[code] = value; // Store value associated with code
			if (value > 0) {
				// Only use positive values for quantile calculation range
				values.push(value);
			}
		}
	});
	values.sort((a, b) => a - b); // Sort values for quantile calculation

	let colorSteps: string[] =
		variableType === "party" ? partyQuintileColors : metricQuintileColors;
	let quintiles: number[] = [];
	if (values.length >= 5) {
		// Need at least 5 positive values for 5 quantiles
		const p = (percent: number) => {
			const index = Math.max(
				0,
				Math.min(
					values.length - 1,
					Math.floor((percent / 100) * (values.length - 1))
				)
			);
			return values[index];
		};
		quintiles = [p(20), p(40), p(60), p(80)];
	}

	// Build the match expression
	const matchExpression: any[] = ["match", ["id"]]; // Match on feature ID (promoted from PCON24CD)

	// *** FIX: Ensure loop runs correctly and adds pairs ***
	if (Object.keys(codeToValue).length > 0) {
		Object.entries(codeToValue).forEach(([code, value]) => {
			let color = NO_DATA_COLOR;
			if (value === 0) {
				color = NO_DATA_COLOR; // Explicitly color 0 as NO_DATA
			} else if (values.length < 2) {
				// Not enough positive values for a range
				color = NO_DATA_COLOR;
			} else if (values.length < 5) {
				// Less than 5 positive points
				if (values[values.length - 1] <= values[0]) {
					// All positive values are the same
					color = colorSteps[2]; // Use middle color
				} else {
					// Simple interpolation for few points
					const min = values[0];
					const max = values[values.length - 1];
					const ratio = Math.max(
						0,
						Math.min(1, (value - min) / (max - min))
					);
					const colorIndex = Math.min(4, Math.floor(ratio * 5));
					color = colorSteps[colorIndex];
				}
			} else {
				// Use quantiles (calculated from positive values)
				if (value < quintiles[0]) color = colorSteps[0];
				else if (value < quintiles[1]) color = colorSteps[1];
				else if (value < quintiles[2]) color = colorSteps[2];
				else if (value < quintiles[3]) color = colorSteps[3];
				else color = colorSteps[4]; // Includes values >= quintiles[3]
			}
			matchExpression.push(code, color); // Add the code and its calculated color
		});
	}

	matchExpression.push(NO_DATA_COLOR); // Add the final fallback color
	// --- End Calculate Color Expression ---

	// *** Check if matchExpression is valid before setting ***
	if (matchExpression.length < 4 && Object.keys(codeToValue).length > 0) {
		console.error(
			`Generated invalid match expression for ${layerId}:`,
			JSON.stringify(matchExpression)
		);
		// Optionally set a default color instead of throwing error
		// mapInstance.setPaintProperty(layerId, "fill-color", NO_DATA_COLOR);
		return; // Prevent setting invalid expression
	} else if (matchExpression.length < 4) {
		// If codeToValue was empty, the expression is just ["match", ["id"], fallback] which is valid
		// but maybe log a warning
		// console.warn(`No valid data found for ${layerId}, using fallback color.`);
	}

	try {
		// --- Update Fill Layer ---
		mapInstance.setPaintProperty(layerId, "fill-color", matchExpression);
		mapInstance.setPaintProperty(layerId, "fill-opacity", 0.75); // No animation

		// --- Update Highlight Layer ---
		const highlighted = highlightedConstituency
			? data.find((d) => d.constituency_name === highlightedConstituency)
			: null;
		const highlightCode = highlighted?.const_code;

		if (highlightCode) {
			mapInstance.setFilter(highlightLayerId, [
				"==",
				FEATURE_ID_PROPERTY,
				highlightCode,
			]);
			mapInstance.setPaintProperty(highlightLayerId, "line-opacity", 1);
		} else {
			mapInstance.setFilter(highlightLayerId, [
				"==",
				FEATURE_ID_PROPERTY,
				"",
			]);
			mapInstance.setPaintProperty(highlightLayerId, "line-opacity", 0);
		}
	} catch (error: any) {
		console.error(`Error setting paint properties for ${layerId}:`, error);
		// Consider setting an error state or logging more prominently
	}
}
