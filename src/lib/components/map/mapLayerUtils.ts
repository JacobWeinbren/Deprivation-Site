// src/lib/components/map/mapLayerUtils.ts

import type { MaplibreMap, MapDataEvent, ConstituencyData } from "$lib/types";
import { getNumericValue } from "$lib/utils";
import {
	MAP_TILE_URL,
	SOURCE_LAYER,
	FEATURE_ID_PROPERTY,
	NO_DATA_COLOR,
	partyQuintileColors,
	metricQuintileColors,
} from "$lib/config";
import { quantile } from "simple-statistics";

const logPrefix = "[MapLayers]";

// addOrUpdateSourceAndLayers function remains the same...
export async function addOrUpdateSourceAndLayers(
	mapInstance: MaplibreMap,
	sourceId: string,
	baseFillLayerId: string,
	baseHighlightLayerId: string
): Promise<void> {
	console.log(
		`${logPrefix} Adding/updating source '${sourceId}' and layers '${baseFillLayerId}', '${baseHighlightLayerId}'`
	);
	return new Promise((resolve, reject) => {
		let sourceListener: ((e: MapDataEvent) => void) | null = null;
		let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
		const cleanup = () => {
			if (sourceListener) {
				mapInstance.off("sourcedata", sourceListener);
				sourceListener = null;
			}
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
				timeoutHandle = null;
			}
		};
		const addLayers = () => {
			try {
				console.log(
					`${logPrefix} Adding layers for source '${sourceId}'`
				);
				if (!mapInstance.getLayer(baseFillLayerId)) {
					mapInstance.addLayer(
						{
							id: baseFillLayerId,
							type: "fill",
							source: sourceId,
							"source-layer": SOURCE_LAYER,
							paint: {
								"fill-color": NO_DATA_COLOR,
								"fill-opacity": 1,
								/* Base opacity */ "fill-outline-color":
									"rgba(0,0,0,0.1)",
							},
						},
						mapInstance.getLayer(baseHighlightLayerId)
							? baseHighlightLayerId
							: undefined
					);
					console.log(`${logPrefix} Added layer: ${baseFillLayerId}`);
				} else {
					console.log(
						`${logPrefix} Layer already exists: ${baseFillLayerId}`
					);
				}
				if (!mapInstance.getLayer(baseHighlightLayerId)) {
					mapInstance.addLayer({
						id: baseHighlightLayerId,
						type: "line",
						source: sourceId,
						"source-layer": SOURCE_LAYER,
						paint: {
							"line-color": "#000",
							"line-width": 3,
							"line-opacity": 0,
						},
						filter: ["==", FEATURE_ID_PROPERTY, ""],
					});
					console.log(
						`${logPrefix} Added layer: ${baseHighlightLayerId}`
					);
				} else {
					console.log(
						`${logPrefix} Layer already exists: ${baseHighlightLayerId}`
					);
				}
				cleanup();
				resolve();
			} catch (layerError) {
				console.error(
					`${logPrefix} Error adding layers for ${sourceId}:`,
					layerError
				);
				cleanup();
				reject(layerError);
			}
		};
		try {
			if (!mapInstance.getSource(sourceId)) {
				console.log(`${logPrefix} Adding source: ${sourceId}`);
				mapInstance.addSource(sourceId, {
					type: "vector",
					tiles: [MAP_TILE_URL],
					promoteId: FEATURE_ID_PROPERTY,
					minzoom: 0,
					maxzoom: 14,
				});
				sourceListener = (e: MapDataEvent) => {
					if (
						e.sourceId === sourceId &&
						e.isSourceLoaded &&
						e.sourceDataType === "metadata"
					) {
						console.log(
							`${logPrefix} Source metadata loaded for ${sourceId}. Adding layers.`
						);
						addLayers();
					} else if (
						e.sourceId === sourceId &&
						e.isSourceLoaded &&
						e.dataType === "source"
					) {
						console.log(
							`${logPrefix} Source fully loaded confirmed for ${sourceId}. Ensuring layers added.`
						);
						addLayers();
					}
				};
				mapInstance.on("sourcedata", sourceListener);
				timeoutHandle = setTimeout(() => {
					if (!mapInstance.getSource(sourceId)) {
						const msg = `Source ${sourceId} failed to load within timeout.`;
						console.error(`${logPrefix} ${msg}`);
						cleanup();
						reject(new Error(msg));
					} else if (
						!mapInstance.getLayer(baseFillLayerId) ||
						!mapInstance.getLayer(baseHighlightLayerId)
					) {
						console.warn(
							`${logPrefix} Adding layers for ${sourceId} via timeout fallback.`
						);
						addLayers();
					} else {
						console.log(
							`${logPrefix} Timeout reached, but source/layers seem okay for ${sourceId}. Resolving.`
						);
						cleanup();
						resolve();
					}
				}, 10000);
				if (mapInstance.isSourceLoaded(sourceId)) {
					console.log(
						`${logPrefix} Source ${sourceId} already loaded. Proceeding to add layers.`
					);
					addLayers();
				}
			} else {
				console.log(
					`${logPrefix} Source ${sourceId} already exists. Ensuring layers are added.`
				);
				addLayers();
			}
		} catch (sourceError) {
			console.error(
				`${logPrefix} Critical error adding source ${sourceId}:`,
				sourceError
			);
			cleanup();
			reject(sourceError);
		}
	});
}

/**
 * Updates the map paint properties (fill-color, fill-opacity, highlight filter/opacity)
 * based on the selected variable and data.
 */
export function updateMapPaint(
	mapInstance: MaplibreMap | null,
	fillLayerId: string,
	highlightLayerId: string,
	variableType: "party" | "metric",
	variableKey: string,
	data: ConstituencyData[],
	highlightedConstituencyName: string | null // Pass the name
) {
	if (
		!mapInstance ||
		!mapInstance.isStyleLoaded() ||
		!mapInstance.getLayer(fillLayerId) ||
		!mapInstance.getLayer(highlightLayerId)
	) {
		return;
	}

	// Find the code of the highlighted constituency
	const highlightedCode = highlightedConstituencyName
		? data.find((d) => d.constituency_name === highlightedConstituencyName)
				?.const_code
		: null;

	// --- Calculate Color Expression (remains the same) ---
	const values: number[] = [];
	const featureData: { [code: string]: number | null } = {};
	data.forEach((d) => {
		const code = d.const_code;
		if (!code) return;
		const value = getNumericValue(d, variableKey);
		featureData[code] = value;
		if (value !== null && isFinite(value) && value > 0) {
			values.push(value);
		}
	});
	values.sort((a, b) => a - b);
	const colorSteps =
		variableType === "party" ? partyQuintileColors : metricQuintileColors;
	let quintiles: number[] = [];
	if (values.length >= 5) {
		try {
			quintiles = [0.2, 0.4, 0.6, 0.8].map((p) => quantile(values, p));
		} catch (e) {
			console.error(`${logPrefix} Error calculating quantiles:`, e);
			quintiles = [];
		}
	}
	const matchExpression: any[] = ["match", ["id"]];
	Object.entries(featureData).forEach(([code, value]) => {
		let color = NO_DATA_COLOR;
		if (value !== null && isFinite(value)) {
			if (value === 0) {
				color = values.length === 0 ? colorSteps[2] : NO_DATA_COLOR;
			} else if (values.length < 2) {
				color = colorSteps[2];
			} else if (values.length < 5 || quintiles.length < 4) {
				const min = values[0];
				const max = values[values.length - 1];
				if (max <= min) {
					color = colorSteps[2];
				} else {
					const ratio = Math.max(
						0,
						Math.min(1, (value - min) / (max - min))
					);
					const colorIndex = Math.min(4, Math.floor(ratio * 5));
					color = colorSteps[colorIndex];
				}
			} else {
				if (value < quintiles[0]) color = colorSteps[0];
				else if (value < quintiles[1]) color = colorSteps[1];
				else if (value < quintiles[2]) color = colorSteps[2];
				else if (value < quintiles[3]) color = colorSteps[3];
				else color = colorSteps[4];
			}
		}
		matchExpression.push(code, color);
	});
	matchExpression.push(NO_DATA_COLOR);

	// --- Define Opacity Expression ---
	const baseOpacity = 1;
	const dimmedOpacity = 0.2;
	const highlightedOpacity = 1;

	const opacityExpression = highlightedCode
		? [
				"case",
				["==", ["id"], highlightedCode], // Check if feature ID matches highlighted code
				highlightedOpacity, // Opacity if highlighted
				dimmedOpacity, // Opacity if *not* highlighted (but something *is* highlighted)
		  ]
		: baseOpacity; // Opacity if *nothing* is highlighted

	// --- Update Fill Layer ---
	try {
		mapInstance.setPaintProperty(
			fillLayerId,
			"fill-color",
			matchExpression
		);
		// *** SET DYNAMIC OPACITY ***
		mapInstance.setPaintProperty(
			fillLayerId,
			"fill-opacity",
			opacityExpression
		);
	} catch (error) {
		console.error(
			`${logPrefix} Error setting fill paint for ${fillLayerId}:`,
			error
		);
	}

	// --- Update Highlight Layer (Filter/Opacity) ---
	try {
		if (highlightedCode) {
			mapInstance.setFilter(highlightLayerId, [
				"==",
				FEATURE_ID_PROPERTY,
				highlightedCode,
			]);
			mapInstance.setPaintProperty(highlightLayerId, "line-opacity", 1); // Highlight line always fully opaque when shown
		} else {
			mapInstance.setFilter(highlightLayerId, [
				"==",
				FEATURE_ID_PROPERTY,
				"",
			]);
			mapInstance.setPaintProperty(highlightLayerId, "line-opacity", 0);
		}
	} catch (error) {
		console.error(
			`${logPrefix} Error setting highlight for ${highlightLayerId}:`,
			error
		);
	}
}
