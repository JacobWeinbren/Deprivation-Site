<!-- src/lib/components/ConstituencyCompareMap.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import type {
		LngLatLike,
		Expression,
		LngLatBoundsLike,
		StyleSpecification,
		Map as MaplibreMap,
		MapOptions,
		ErrorEvent,
		MapDataEvent,
		MapMouseEvent,
	} from "maplibre-gl";

	import { browser } from "$app/environment";

	import {
		type ConstituencyData,
		type MetricOption,
		type PartyOption,
	} from "./chartConfig";
	import { getNumericValue } from "./utils";

	import { createEventDispatcher } from "svelte";
	const dispatch = createEventDispatcher<{
		constituencyClick: { name: string };
	}>();

	// --- Props ---
	export let data: ConstituencyData[] = [];
	export let selectedParty: string = "";
	export let selectedMetric: string = "";
	export let highlightedConstituency: string | null = null;
	export let metrics: MetricOption[] = [];
	export let parties: PartyOption[] = [];
	export let partyColors: { [key: string]: string } = {};
	export let mapboxAccessToken: string;
	export let mapIdLeft: string =
		"compare-map-left-" + Math.random().toString(36).substring(2, 9);
	export let mapIdRight: string =
		"compare-map-right-" + Math.random().toString(36).substring(2, 9);

	// --- State ---
	let mapLeftContainer: HTMLDivElement;
	let mapRightContainer: HTMLDivElement;
	let mapLeft: MaplibreMap | null = null;
	let mapRight: MaplibreMap | null = null;
	let compareControl: any = null;
	let isLoading: boolean = true;
	let errorMessage: string | null = null;
	let mapsInitialized = false;
	let sourcesAndLayersAdded = false;
	let isMapReadyForData = false;
	let updateCounter = 0; // Track update attempts

	// Debug flags
	let sourceLeftLoaded = false;
	let sourceRightLoaded = false;
	let layersLeftAdded = false;
	let layersRightAdded = false;
	let leftDataApplied = false;
	let rightDataApplied = false;

	// --- Variables to hold dynamically imported modules/classes ---
	let maplibregl: typeof import("maplibre-gl") | null = null;
	let MaplibreCompare: any = null;

	// Legend state
	let leftLabel: string = "";
	let leftMinValue: number | null = null;
	let leftMaxValue: number | null = null;
	let rightLabel: string = "";
	let rightMinValue: number | null = null;
	let rightMaxValue: number | null = null;

	// Tracking previous values
	let prevSelectedParty = selectedParty;
	let prevSelectedMetric = selectedMetric;
	let prevHighlight = highlightedConstituency;
	let prevDataLength = data?.length ?? 0;

	// Shared constants
	const SOURCE_ID_LEFT = "constituencies-source-left";
	const LAYER_ID_LEFT = "constituency-fills-left";
	const SOURCE_ID_RIGHT = "constituencies-source-right";
	const LAYER_ID_RIGHT = "constituency-fills-right";
	const SOURCE_LAYER = "uk-constituencies";
	const FEATURE_ID_PROPERTY = "PCON24CD";
	const NO_DATA_COLOR = "#e0e0e0";

	// --- Map Initialization Options ---
	const bounds: LngLatBoundsLike = [
		[-10.8, 49.5],
		[2.0, 61.0],
	];
	const minimalStyle: StyleSpecification = {
		version: 8,
		sources: {},
		layers: [],
	};
	let mapOptions: Omit<MapOptions, "container">;

	// --- Helper function to lighten colors ---
	function lightenColor(hex: string, factor: number): string {
		hex = hex.replace("#", "");
		let r = parseInt(hex.substring(0, 2), 16);
		let g = parseInt(hex.substring(2, 4), 16);
		let b = parseInt(hex.substring(4, 6), 16);
		r = Math.min(255, Math.round(r + (255 - r) * factor));
		g = Math.min(255, Math.round(g + (255 - g) * factor));
		b = Math.min(255, Math.round(b + (255 - b) * factor));
		return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
	}

	// --- IMPROVED: Add Source and Layer with detailed logging ---
	async function addSourceAndLayer(
		mapInstance: MaplibreMap,
		sourceId: string,
		layerId: string
	): Promise<void> {
		console.log(
			`[DEBUG] Starting addSourceAndLayer for ${sourceId}/${layerId}`
		);

		return new Promise((resolve, reject) => {
			try {
				// First check if the source already exists
				if (!mapInstance.getSource(sourceId)) {
					console.log(
						`[DEBUG] Adding vector tile source ${sourceId}`
					);
					mapInstance.addSource(sourceId, {
						type: "vector",
						tiles: [
							"https://map.jacobweinbren.workers.dev/gb-constituencies/{z}/{x}/{y}.mvt",
						],
						promoteId: FEATURE_ID_PROPERTY,
						minzoom: 0,
						maxzoom: 17,
					});

					// Log source information after adding
					console.log(
						`[DEBUG] Source ${sourceId} added to map, waiting for tiles...`
					);

					// Listen for the source to load
					const checkSourceLoaded = (e: MapDataEvent) => {
						if (e.sourceId === sourceId && e.isSourceLoaded) {
							console.log(
								`[DEBUG] Source ${sourceId} loaded via event!`
							);
							mapInstance.off("sourcedata", checkSourceLoaded);

							if (sourceId === SOURCE_ID_LEFT) {
								sourceLeftLoaded = true;
							} else if (sourceId === SOURCE_ID_RIGHT) {
								sourceRightLoaded = true;
							}

							addLayersAndResolve();
						}
					};

					mapInstance.on("sourcedata", checkSourceLoaded);

					// Check if source is already loaded
					if (mapInstance.isSourceLoaded(sourceId)) {
						console.log(
							`[DEBUG] Source ${sourceId} was loaded immediately`
						);
						mapInstance.off("sourcedata", checkSourceLoaded);

						if (sourceId === SOURCE_ID_LEFT) {
							sourceLeftLoaded = true;
						} else if (sourceId === SOURCE_ID_RIGHT) {
							sourceRightLoaded = true;
						}

						addLayersAndResolve();
					}
				} else {
					console.log(
						`[DEBUG] Source ${sourceId} already exists, proceeding to layers`
					);

					if (sourceId === SOURCE_ID_LEFT) {
						sourceLeftLoaded = true;
					} else if (sourceId === SOURCE_ID_RIGHT) {
						sourceRightLoaded = true;
					}

					addLayersAndResolve();
				}

				function addLayersAndResolve() {
					if (!mapInstance.getLayer(layerId)) {
						console.log(
							`[DEBUG] Adding main fill layer ${layerId}`
						);
						mapInstance.addLayer({
							id: layerId,
							type: "fill",
							source: sourceId,
							"source-layer": SOURCE_LAYER,
							paint: {
								"fill-color": NO_DATA_COLOR,
								"fill-opacity": 0.75,
								"fill-outline-color": [
									"case",
									[
										"boolean",
										["feature-state", "highlighted"],
										false,
									],
									"#000000",
									"rgba(0,0,0,0.1)",
								],
							},
						});

						console.log(
							`[DEBUG] Adding outline layer ${layerId}-highlight-outline`
						);
						mapInstance.addLayer({
							id: `${layerId}-highlight-outline`,
							type: "line",
							source: sourceId,
							"source-layer": SOURCE_LAYER,
							paint: {
								"line-color": "#000000",
								"line-width": 2.5,
								"line-opacity": [
									"case",
									[
										"boolean",
										["feature-state", "highlighted"],
										false,
									],
									1,
									0,
								],
							},
						});

						if (layerId === LAYER_ID_LEFT) {
							layersLeftAdded = true;
						} else if (layerId === LAYER_ID_RIGHT) {
							layersRightAdded = true;
						}
					} else {
						console.log(`[DEBUG] Layer ${layerId} already exists`);

						if (layerId === LAYER_ID_LEFT) {
							layersLeftAdded = true;
						} else if (layerId === LAYER_ID_RIGHT) {
							layersRightAdded = true;
						}
					}

					// Test for feature states with a sample feature
					try {
						const features = mapInstance.querySourceFeatures(
							sourceId,
							{
								sourceLayer: SOURCE_LAYER,
								limit: 1,
							}
						);

						if (features.length > 0) {
							const testId =
								features[0].id ||
								features[0].properties?.[FEATURE_ID_PROPERTY];
							console.log(
								`[DEBUG] Found test feature with ID: ${testId}`
							);

							if (testId) {
								// Test setting a feature state
								mapInstance.setFeatureState(
									{
										source: sourceId,
										sourceLayer: SOURCE_LAYER,
										id: testId,
									},
									{ testValue: 1, _timestamp: Date.now() }
								);
								console.log(
									`[DEBUG] Test feature state set for ${testId}`
								);
							}
						} else {
							console.warn(
								`[DEBUG] No test features found for ${sourceId}`
							);
						}
					} catch (e) {
						console.warn(
							`[DEBUG] Error testing feature state: ${e.message}`
						);
					}

					console.log(
						`[DEBUG] Resolving addSourceAndLayer for ${layerId}`
					);
					resolve();
				}

				// Safety timeout - shorter timeout for faster detection of issues
				setTimeout(() => {
					if (!mapInstance.getSource(sourceId)) {
						console.error(
							`[DEBUG] Source ${sourceId} failed to load within timeout!`
						);
						reject(
							new Error(
								`Source ${sourceId} failed to load within timeout`
							)
						);
					} else if (!mapInstance.getLayer(layerId)) {
						console.warn(
							`[DEBUG] Adding layers for ${layerId} via timeout fallback`
						);
						addLayersAndResolve();
					}
				}, 3000);
			} catch (error) {
				console.error(
					`[DEBUG] Critical error in addSourceAndLayer for ${layerId}:`,
					error
				);
				reject(error);
			}
		});
	}

	// --- IMPROVED: Helper to update feature states with detailed logging ---
	function updateFeatureStates(
		mapInstance: MaplibreMap | null,
		sourceId: string,
		variableKey: string,
		variableType: "party" | "metric"
	): boolean {
		console.log(
			`[DEBUG] updateFeatureStates for ${sourceId}, key: ${variableKey}, type: ${variableType}`
		);

		if (!mapInstance) {
			console.warn(
				`[DEBUG] updateFeatureStates: mapInstance is null for ${sourceId}`
			);
			return false;
		}

		if (!mapInstance.isStyleLoaded()) {
			console.warn(
				`[DEBUG] updateFeatureStates: style not loaded for ${sourceId}`
			);
			return false;
		}

		if (!mapInstance.getSource(sourceId)) {
			console.warn(
				`[DEBUG] updateFeatureStates: source ${sourceId} not found`
			);
			return false;
		}

		if (!data || data.length === 0) {
			console.warn(
				`[DEBUG] updateFeatureStates: no data available (length: ${data?.length || 0})`
			);
			return false;
		}

		if (!variableKey) {
			console.warn(
				`[DEBUG] updateFeatureStates: no variableKey provided`
			);
			return false;
		}

		console.log(
			`[DEBUG] Processing ${data.length} data points for ${sourceId}`
		);

		// Include 0 in the calculation for min/max
		const validValues: number[] = [];
		const featureData: {
			[code: string]: { value: number | null; name: string };
		} = {};

		// First pass to collect data
		data.forEach((d) => {
			const code = d.const_code;
			const name = d.constituency_name;
			if (!code || !name) return;

			const value = getNumericValue(d, variableKey);
			featureData[code] = { value, name };

			// Condition changed to value >= 0
			if (value !== null && isFinite(value) && value >= 0) {
				validValues.push(value);
			}
		});

		console.log(
			`[DEBUG] Found ${Object.keys(featureData).length} valid constituencies with codes`
		);
		console.log(
			`[DEBUG] Found ${validValues.length} constituencies with numeric values >= 0`
		);

		// Calculate Min/Max from valid, non-negative values
		const currentMinValue =
			validValues.length > 0 ? Math.min(...validValues) : null;
		const currentMaxValue =
			validValues.length > 0 ? Math.max(...validValues) : null;

		console.log(
			`[DEBUG] Value range: min=${currentMinValue}, max=${currentMaxValue}`
		);

		// Update legend state variables
		if (variableType === "party") {
			const partyInfo = parties.find((p) => p.value === variableKey);
			leftLabel = partyInfo?.label || variableKey;
			leftMinValue = currentMinValue;
			leftMaxValue = currentMaxValue;
		} else {
			const metricInfo = metrics.find((m) => m.value === variableKey);
			rightLabel = metricInfo?.label || variableKey;
			rightMinValue = currentMinValue;
			rightMaxValue = currentMaxValue;
		}

		// Debug: Output several example values
		const sampleEntries = Object.entries(featureData).slice(0, 5);
		console.log(
			`[DEBUG] Sample data (first 5 entries):`,
			sampleEntries
				.map(([code, { value, name }]) => `${code}: ${name} = ${value}`)
				.join(", ")
		);

		// Set feature states
		let featuresUpdated = 0;
		let featuresMissing = 0;

		Object.entries(featureData).forEach(([code, { value, name }]) => {
			const isHighlighted = name === highlightedConstituency;
			const finalValue =
				typeof value === "number" && isFinite(value) ? value : null;

			try {
				const features = mapInstance.querySourceFeatures(sourceId, {
					sourceLayer: SOURCE_LAYER,
					filter: ["==", FEATURE_ID_PROPERTY, code],
				});

				if (features.length > 0) {
					mapInstance.setFeatureState(
						{
							source: sourceId,
							sourceLayer: SOURCE_LAYER,
							id: code,
						},
						{
							value: finalValue,
							highlighted: isHighlighted,
							_updated: Date.now(), // Add timestamp for debugging
						}
					);
					featuresUpdated++;
				} else {
					featuresMissing++;
				}
			} catch (e) {
				console.warn(
					`[DEBUG] Error setting feature state for ${code}: ${e.message}`
				);
			}
		});

		console.log(
			`[DEBUG] Feature states updated: ${featuresUpdated}, missing: ${featuresMissing}`
		);

		if (variableType === "party") {
			leftDataApplied = featuresUpdated > 0;
		} else {
			rightDataApplied = featuresUpdated > 0;
		}

		return featuresUpdated > 0;
	}

	// --- IMPROVED: Update paint expression with detailed logging ---
	// Replace the updatePaintExpression function with this simplified version
	function updatePaintExpression(
		mapInstance: MaplibreMap | null,
		layerId: string,
		variableType: "party" | "metric",
		variableKey: string
	) {
		console.log(
			`[DEBUG] updatePaintExpression for ${layerId}, key: ${variableKey}, type: ${variableType}`
		);

		if (
			!mapInstance ||
			!mapInstance.isStyleLoaded() ||
			!mapInstance.getLayer(layerId)
		) {
			console.warn(
				`[DEBUG] updatePaintExpression: conditions not met for ${layerId}`
			);
			return;
		}

		// Get the valid, non-negative data points
		const values: number[] = [];
		data.forEach((d) => {
			const value = getNumericValue(d, variableKey);
			if (value !== null && isFinite(value) && value >= 0) {
				values.push(value);
			}
		});
		values.sort((a, b) => a - b);
		console.log(
			`[DEBUG] Found ${values.length} valid sorted values for paint calculation`
		);

		if (values.length > 0) {
			console.log(
				`[DEBUG] Value range: min=${values[0]}, max=${values[values.length - 1]}`
			);
		}

		// SUPER SIMPLIFIED: Use a basic "match" expression based on constituency codes
		const matchExpression: any[] = ["match", ["get", FEATURE_ID_PROPERTY]];

		// Build a map of constituency codes to values
		const codeToValue: { [code: string]: number } = {};
		data.forEach((d) => {
			const code = d.const_code;
			const value = getNumericValue(d, variableKey);
			if (code && value !== null && isFinite(value) && value >= 0) {
				codeToValue[code] = value;
			}
		});

		// For quintiles
		const baseColor =
			variableType === "party"
				? partyColors[variableKey] || "#C7002F"
				: "#225ea8";

		let colorSteps: string[];

		if (variableType === "party") {
			colorSteps = [
				lightenColor(baseColor, 0.8),
				lightenColor(baseColor, 0.6),
				lightenColor(baseColor, 0.4),
				lightenColor(baseColor, 0.2),
				baseColor,
			];
			console.log(`[DEBUG] Party color steps: ${colorSteps.join(", ")}`);
		} else {
			colorSteps = [
				"#ffffd9",
				"#c7e9b4",
				"#7fcdbb",
				"#41b6c4",
				"#225ea8",
			];
			console.log(`[DEBUG] Metric color steps: ${colorSteps.join(", ")}`);
		}

		// Calculate quintile breaks
		let quintiles: number[] = [];
		if (values.length >= 5) {
			const p = (percent: number) => {
				const index = Math.floor((percent / 100) * (values.length - 1));
				return values[index];
			};
			quintiles = [p(20), p(40), p(60), p(80)];
			console.log(`[DEBUG] Quintile values: ${quintiles.join(", ")}`);
		}

		// Add each constituency code and its color to the match expression
		Object.entries(codeToValue).forEach(([code, value]) => {
			let color = NO_DATA_COLOR; // Default

			if (values.length < 2) {
				color = NO_DATA_COLOR;
			} else if (values.length < 5) {
				// Simple gradient for few values
				if (values[values.length - 1] <= values[0]) {
					color = lightenColor(baseColor, 0.8);
				} else {
					const min = values[0];
					const max = values[values.length - 1];
					const ratio = Math.max(
						0,
						Math.min(1, (value - min) / (max - min))
					);
					const colorIndex = Math.floor(ratio * 4);
					color = colorSteps[colorIndex];
				}
			} else {
				// Use quintiles
				if (value < quintiles[0]) color = colorSteps[0];
				else if (value < quintiles[1]) color = colorSteps[1];
				else if (value < quintiles[2]) color = colorSteps[2];
				else if (value < quintiles[3]) color = colorSteps[3];
				else color = colorSteps[4];
			}

			matchExpression.push(code, color);
		});

		// Default case - last element in the match expression
		matchExpression.push(NO_DATA_COLOR);

		console.log(
			`[DEBUG] Setting fill-color expression for ${layerId} (Using match syntax)`
		);

		try {
			// Set the match expression - this avoids all feature-state issues
			mapInstance.setPaintProperty(
				layerId,
				"fill-color",
				matchExpression
			);

			// Set outline colors the simple way
			mapInstance.setPaintProperty(
				layerId,
				"fill-outline-color",
				"rgba(0,0,0,0.1)" // Simple static outline color
			);

			console.log(
				`[DEBUG] Paint properties updated successfully for ${layerId}`
			);
		} catch (error) {
			console.error(`[DEBUG] Error setting paint for ${layerId}:`, error);
			errorMessage = `Map paint error for ${layerId}: ${error.message}`;
		}

		// Now set highlight directly in the updateFeatureStates function instead
		try {
			if (highlightedConstituency) {
				// Find the constituency code for the highlighted name
				const highlighted = data.find(
					(d) => d.constituency_name === highlightedConstituency
				);
				if (highlighted?.const_code) {
					mapInstance.setFilter(`${layerId}-highlight-outline`, [
						"==",
						["get", FEATURE_ID_PROPERTY],
						highlighted.const_code,
					]);
					mapInstance.setPaintProperty(
						`${layerId}-highlight-outline`,
						"line-opacity",
						1
					);
				}
			} else {
				// No highlighting - hide all outlines
				mapInstance.setFilter(`${layerId}-highlight-outline`, [
					"==",
					"const_code",
					"",
				]);
				mapInstance.setPaintProperty(
					`${layerId}-highlight-outline`,
					"line-opacity",
					0
				);
			}
		} catch (e) {
			console.warn(`[DEBUG] Error setting highlight: ${e.message}`);
		}
	}

	// --- IMPROVED: Main Update Function with detailed logging ---
	function updateCompareMaps(forceUpdate = false) {
		updateCounter++;
		console.log(
			`[DEBUG] updateCompareMaps (#${updateCounter}) ENTRY - force=${forceUpdate}`
		);
		console.log(
			`[DEBUG] Current state: maps=${mapsInitialized}, sources=${sourcesAndLayersAdded}, ready=${isMapReadyForData}`
		);

		if (!mapsInitialized || !sourcesAndLayersAdded || !isMapReadyForData) {
			console.warn(
				`[DEBUG] Exiting updateCompareMaps early - conditions not met`
			);
			return;
		}

		if (!mapLeft || !mapRight) {
			console.warn(
				`[DEBUG] Maps not available: left=${!!mapLeft}, right=${!!mapRight}`
			);
			return;
		}

		console.log(
			`[DEBUG] Data check: ${data.length} rows, party=${selectedParty}, metric=${selectedMetric}`
		);
		errorMessage = null;

		// IMPORTANT: Clear feature states first to avoid stale data
		try {
			console.log("[DEBUG] Clearing existing feature states...");
			// Try to clear all feature states
			if (mapLeft && mapLeft.getSource(SOURCE_ID_LEFT)) {
				mapLeft.removeFeatureState({
					source: SOURCE_ID_LEFT,
					sourceLayer: SOURCE_LAYER,
				});
			}
			if (mapRight && mapRight.getSource(SOURCE_ID_RIGHT)) {
				mapRight.removeFeatureState({
					source: SOURCE_ID_RIGHT,
					sourceLayer: SOURCE_LAYER,
				});
			}
		} catch (e) {
			console.warn("[DEBUG] Error clearing feature states:", e);
		}

		// Update feature states
		console.log(
			`[DEBUG] Updating feature states for LEFT with key: ${selectedParty}`
		);
		const stateUpdatedLeft = updateFeatureStates(
			mapLeft,
			SOURCE_ID_LEFT,
			selectedParty,
			"party"
		);

		console.log(
			`[DEBUG] Updating feature states for RIGHT with key: ${selectedMetric}`
		);
		const stateUpdatedRight = updateFeatureStates(
			mapRight,
			SOURCE_ID_RIGHT,
			selectedMetric,
			"metric"
		);

		// Then update the paint properties
		console.log(
			`[DEBUG] Updating paint expressions: left=${stateUpdatedLeft}, right=${stateUpdatedRight}`
		);

		if (stateUpdatedLeft || forceUpdate) {
			updatePaintExpression(
				mapLeft,
				LAYER_ID_LEFT,
				"party",
				selectedParty
			);
		}

		if (stateUpdatedRight || forceUpdate) {
			updatePaintExpression(
				mapRight,
				LAYER_ID_RIGHT,
				"metric",
				selectedMetric
			);
		}

		// Force map redraw
		console.log("[DEBUG] Forcing map redraw to ensure data visibility");
		mapLeft?.triggerRepaint();
		mapRight?.triggerRepaint();

		console.log(`[DEBUG] updateCompareMaps (#${updateCounter}) EXIT`);
	}

	// --- Lifecycle: onMount with improved initialization sequence ---
	onMount(async () => {
		// Ensure this runs only on the client
		if (!browser) {
			console.log(
				"[DEBUG] Not in browser environment, skipping map initialization"
			);
			return;
		}

		console.log(
			"[DEBUG] ConstituencyCompareMap: onMount started (client-side)"
		);
		isLoading = true;
		mapsInitialized = false;
		sourcesAndLayersAdded = false;
		isMapReadyForData = false;

		try {
			// Dynamically import libraries
			console.log("[DEBUG] Dynamically importing MapLibre GL JS...");
			maplibregl = (await import("maplibre-gl")).default;
			console.log("[DEBUG] MapLibre GL JS imported successfully");

			console.log(
				"[DEBUG] Dynamically importing @maplibre/maplibre-gl-compare..."
			);
			MaplibreCompare = (await import("@maplibre/maplibre-gl-compare"))
				.default;
			console.log(
				"[DEBUG] @maplibre/maplibre-gl-compare imported successfully"
			);

			if (!maplibregl || !MaplibreCompare) {
				throw new Error("Failed to load MapLibre libraries");
			}

			// Define map options now that maplibregl is available
			mapOptions = {
				style: minimalStyle,
				center: [-2, 54.5] as [number, number], // Move center westward
				zoom: 4.5,
				minZoom: 4.5,
				maxZoom: 13,
				pitch: 0,
				bearing: 0,
				pitchWithRotate: false,
				dragRotate: false,
				touchZoomRotate: false,
				attributionControl: false,
			};

			console.log("[DEBUG] Initializing left map...");
			mapLeft = new maplibregl.Map({
				container: mapLeftContainer,
				...mapOptions,
			});

			console.log("[DEBUG] Initializing right map...");
			mapRight = new maplibregl.Map({
				container: mapRightContainer,
				...mapOptions,
			});

			// Add error handlers
			mapLeft.on("error", (e: ErrorEvent) => {
				console.error("[DEBUG] Map Left error:", e.error);
				errorMessage = `Left map error: ${e.error?.message || "Unknown error"}`;
			});

			mapRight.on("error", (e: ErrorEvent) => {
				console.error("[DEBUG] Map Right error:", e.error);
				errorMessage = `Right map error: ${e.error?.message || "Unknown error"}`;
			});

			// Wait for BOTH maps to initially load
			console.log("[DEBUG] Waiting for both maps to load...");
			await Promise.all([
				new Promise<void>((resolve, reject) => {
					mapLeft!.once("load", () => {
						console.log("[DEBUG] Map Left 'load' event fired");
						resolve();
					});
					mapLeft!.once("error", (e: ErrorEvent) => {
						console.error(
							"[DEBUG] Map Left failed to load:",
							e.error
						);
						reject(new Error(`Map Left Load: ${e.error?.message}`));
					});

					// Safety timeout
					setTimeout(() => {
						if (mapLeft!.loaded()) {
							console.log(
								"[DEBUG] Map Left loaded via timeout check"
							);
							resolve();
						}
					}, 2000);
				}),
				new Promise<void>((resolve, reject) => {
					mapRight!.once("load", () => {
						console.log("[DEBUG] Map Right 'load' event fired");
						resolve();
					});
					mapRight!.once("error", (e: ErrorEvent) => {
						console.error(
							"[DEBUG] Map Right failed to load:",
							e.error
						);
						reject(
							new Error(`Map Right Load: ${e.error?.message}`)
						);
					});

					// Safety timeout
					setTimeout(() => {
						if (mapRight!.loaded()) {
							console.log(
								"[DEBUG] Map Right loaded via timeout check"
							);
							resolve();
						}
					}, 2000);
				}),
			]);

			console.log("[DEBUG] Both maps loaded");
			mapsInitialized = true;

			if (!mapLeft || !mapRight) {
				throw new Error("MapLibre maps not initialized after load");
			}

			// Add sources and layers - with more detailed debugging
			console.log("[DEBUG] Adding sources and layers to both maps...");
			try {
				await Promise.all([
					addSourceAndLayer(mapLeft, SOURCE_ID_LEFT, LAYER_ID_LEFT),
					addSourceAndLayer(
						mapRight,
						SOURCE_ID_RIGHT,
						LAYER_ID_RIGHT
					),
				]);
				console.log("[DEBUG] Sources and layers added to both maps");
				sourcesAndLayersAdded = true;
			} catch (e) {
				console.error("[DEBUG] Error adding sources and layers:", e);
				throw new Error(
					`Failed to add sources and layers: ${e.message}`
				);
			}

			if (!mapLeft || !mapRight) {
				throw new Error(
					"Maps not available after adding sources/layers"
				);
			}

			// --- Wait for BOTH maps to become fully loaded ---
			console.log("[DEBUG] Waiting for maps to become idle...");
			await Promise.all([
				new Promise<void>((resolve) => {
					if (mapLeft!.loaded()) {
						console.log("[DEBUG] Map Left already idle");
						resolve();
					} else {
						mapLeft!.once("idle", () => {
							console.log("[DEBUG] Map Left 'idle' event fired");
							resolve();
						});
					}
				}),
				new Promise<void>((resolve) => {
					if (mapRight!.loaded()) {
						console.log("[DEBUG] Map Right already idle");
						resolve();
					} else {
						mapRight!.once("idle", () => {
							console.log("[DEBUG] Map Right 'idle' event fired");
							resolve();
						});
					}
				}),
			]);
			console.log("[DEBUG] Both maps are now idle");

			// Initialize the compare control
			console.log("[DEBUG] Initializing MaplibreCompare control...");
			if (mapLeft && mapRight) {
				compareControl = new MaplibreCompare(
					mapLeft,
					mapRight,
					"#compare-container"
				);
				console.log("[DEBUG] Compare control initialized");
			} else {
				throw new Error("Maps became unavailable before compare init");
			}

			// Make maps visible after basic setup
			console.log("[DEBUG] Making map containers visible");
			mapLeftContainer.style.opacity = "1";
			mapRightContainer.style.opacity = "1";

			// Add click handler for left map
			mapLeft.on("click", (e: MapMouseEvent) => {
				const features = mapLeft!.queryRenderedFeatures(e.point, {
					layers: [LAYER_ID_LEFT],
				});

				if (features.length > 0) {
					const feature = features[0];
					const properties = feature.properties;
					const name = properties?.PCON24NM || properties?.NAME;

					if (name) {
						console.log(
							`[DEBUG] Left map clicked constituency: ${name}`
						);
						dispatch("constituencyClick", { name });
					}
				}
			});

			// Add click handler for right map
			mapRight.on("click", (e: MapMouseEvent) => {
				const features = mapRight!.queryRenderedFeatures(e.point, {
					layers: [LAYER_ID_RIGHT],
				});

				if (features.length > 0) {
					const feature = features[0];
					const properties = feature.properties;
					const name = properties?.PCON24NM || properties?.NAME;

					if (name) {
						console.log(
							`[DEBUG] Right map clicked constituency: ${name}`
						);
						dispatch("constituencyClick", { name });
					}
				}
			});

			// Set up debugging mouse events to check feature states
			mapLeft.on("mousemove", (e: MapMouseEvent) => {
				const features = mapLeft!.queryRenderedFeatures(e.point, {
					layers: [LAYER_ID_LEFT],
				});
				if (features.length > 0) {
					const feature = features[0];
					const id =
						feature.id || feature.properties?.[FEATURE_ID_PROPERTY];
					if (id) {
						const state = mapLeft!.getFeatureState({
							source: SOURCE_ID_LEFT,
							sourceLayer: SOURCE_LAYER,
							id,
						});
						console.log(
							`[DEBUG] LEFT Map feature state at ${e.lngLat.lng.toFixed(4)},${e.lngLat.lat.toFixed(4)}:`,
							id,
							state
						);
					}
				}
			});

			// NOW it's safe to trigger the first update
			console.log("[DEBUG] Setting isMapReadyForData = true");
			isMapReadyForData = true;

			// Initial update
			console.log("[DEBUG] Triggering initial updateCompareMaps call");
			updateCompareMaps(true); // Force update

			// Additional updates with delays to ensure rendering
			const scheduleUpdate = (delay: number, forceUpdate = false) => {
				setTimeout(() => {
					console.log(`[DEBUG] Scheduled update after ${delay}ms`);
					updateCompareMaps(forceUpdate);
				}, delay);
			};

			// Schedule multiple updates with increasing delays
			scheduleUpdate(500, true);
			scheduleUpdate(1500, true);
			scheduleUpdate(3000);

			isLoading = false;
			console.log("[DEBUG] Map initialization complete");
		} catch (error: any) {
			console.error("[DEBUG] Error during map setup:", error);
			errorMessage = `Map setup failed: ${error.message || error}`;
			isLoading = false;
			isMapReadyForData = false;
		}
	});

	// --- Lifecycle: onDestroy ---
	onDestroy(() => {
		console.log("[DEBUG] onDestroy called, cleaning up maps");
		mapsInitialized = false;
		sourcesAndLayersAdded = false;
		isMapReadyForData = false;

		if (compareControl && typeof compareControl.remove === "function") {
			try {
				compareControl.remove();
				console.log("[DEBUG] Compare control removed");
			} catch (e) {
				console.warn("[DEBUG] Error removing compare control:", e);
			}
		}

		if (mapLeft) {
			try {
				mapLeft.remove();
				console.log("[DEBUG] Left map removed");
			} catch (e) {
				console.warn("[DEBUG] Error removing left map:", e);
			}
		}

		if (mapRight) {
			try {
				mapRight.remove();
				console.log("[DEBUG] Right map removed");
			} catch (e) {
				console.warn("[DEBUG] Error removing right map:", e);
			}
		}

		mapLeft = null;
		mapRight = null;
		compareControl = null;
		maplibregl = null;
		MaplibreCompare = null;
		console.log("[DEBUG] Cleanup complete");
	});

	// --- Reactive Update Logic ---
	$: {
		// Ensure maps are fully ready before reacting to prop changes
		if (
			browser &&
			isMapReadyForData &&
			mapsInitialized &&
			sourcesAndLayersAdded &&
			(data?.length !== prevDataLength ||
				selectedParty !== prevSelectedParty ||
				selectedMetric !== prevSelectedMetric ||
				highlightedConstituency !== prevHighlight)
		) {
			console.log("[DEBUG] Reactive update triggered");
			console.log(
				`[DEBUG] Changes detected: data=${data?.length !== prevDataLength}, party=${selectedParty !== prevSelectedParty}, metric=${selectedMetric !== prevSelectedMetric}, highlight=${highlightedConstituency !== prevHighlight}`
			);
			updateCompareMaps();
			prevDataLength = data?.length ?? 0;
			prevSelectedParty = selectedParty;
			prevSelectedMetric = selectedMetric;
			prevHighlight = highlightedConstituency;
		}
	}

	// --- formatLegendLabel helper ---
	function formatLegendLabel(value: number | null): string {
		if (value === null || value === undefined) return "N/A";
		const numValue = Number(value);
		if (isNaN(numValue)) return "N/A";
		const checkLabel = leftLabel || rightLabel || "";
		if (checkLabel.includes("(%)") || checkLabel.includes("Voteshare")) {
			if (numValue >= 0 && numValue <= 1 && !checkLabel.includes("%")) {
				return `${(numValue * 100).toFixed(1)}%`;
			}
			return `${numValue.toFixed(1)}%`;
		}
		if (checkLabel.includes("(£)")) {
			return numValue >= 1000
				? `£${(numValue / 1000).toFixed(0)}k`
				: `£${numValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
		}
		if (Math.abs(numValue) < 1 && numValue !== 0)
			return numValue.toFixed(2);
		if (Math.abs(numValue) < 10) return numValue.toFixed(1);
		if (Math.abs(numValue) >= 10000)
			return (numValue / 1000).toFixed(0) + "k";
		return numValue.toLocaleString(undefined, { maximumFractionDigits: 0 });
	}

	// Define fixed quintile colors
	const metricQuintileColors = [
		"#ffffd9",
		"#c7e9b4",
		"#7fcdbb",
		"#41b6c4",
		"#225ea8",
	];
</script>

<!-- Add debug information -->
{#if errorMessage}
	<div class="debug-bar">
		<strong>Debug:</strong> Left source: {sourceLeftLoaded ? "✅" : "❌"},
		Right source: {sourceRightLoaded ? "✅" : "❌"}, Left layers: {layersLeftAdded
			? "✅"
			: "❌"}, Right layers: {layersRightAdded ? "✅" : "❌"}, Left data: {leftDataApplied
			? "✅"
			: "❌"}, Right data: {rightDataApplied ? "✅" : "❌"}, Updates: {updateCounter}
	</div>
{/if}

<!-- HTML Template -->
<div
	class="relative font-sans border border-gray-200/75 rounded-lg bg-white overflow-hidden shadow-sm"
>
	<!-- Error/Loading Overlays -->
	{#if errorMessage}
		<div
			class="absolute inset-0 flex items-center justify-center bg-red-50 text-red-700 p-6 z-30 rounded-lg text-center"
		>
			<div class="flex flex-col items-center">
				<svg
					class="w-8 h-8 mb-2 text-red-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					></path></svg
				>
				<span class="font-medium text-sm">Map Error</span>
				<p class="text-xs mt-1">{errorMessage}</p>
				<button
					class="mt-3 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 text-xs rounded-md"
					on:click={() => {
						if (mapLeft && mapRight) {
							errorMessage = null;
							updateCompareMaps(true);
						}
					}}
				>
					Force Retry
				</button>
			</div>
		</div>
	{/if}
	{#if isLoading && !errorMessage}
		<div
			class="absolute inset-0 flex items-center justify-center bg-gray-50/80 text-gray-500 p-6 z-30 rounded-lg"
		>
			<div class="flex flex-col items-center justify-center text-center">
				<svg
					class="animate-spin h-6 w-6 text-blue-600 mb-2"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					><circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					></circle><path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path></svg
				>
				<p class="text-xs font-medium">Loading map...</p>
			</div>
		</div>
	{/if}

	<!-- Container for the Compare Control -->
	<div
		id="compare-container"
		class="relative w-full h-[450px] sm:h-[500px] rounded-t-lg overflow-hidden bg-gray-100 {isLoading ||
		errorMessage
			? 'opacity-50 blur-[2px] pointer-events-none'
			: ''}"
	>
		<!-- Start with opacity 0, fade in via onMount -->
		<div
			bind:this={mapLeftContainer}
			id={mapIdLeft}
			class="absolute top-0 bottom-0 w-full h-full opacity-0 transition-opacity duration-500 ease-in-out"
		></div>
		<div
			bind:this={mapRightContainer}
			id={mapIdRight}
			class="absolute top-0 bottom-0 w-full h-full opacity-0 transition-opacity duration-500 ease-in-out"
		></div>
	</div>

	<!-- Combined Legend -->
	{#if !isLoading && !errorMessage}
		<div
			class="bg-white p-2.5 rounded-b-lg border-t border-gray-200/75 grid grid-cols-1 sm:grid-cols-2 gap-3 items-start"
		>
			<!-- Left Legend (Party) -->
			<div class="text-center sm:text-left">
				<div
					class="text-xs font-medium text-gray-700 mb-1 truncate"
					title={leftLabel || "Party Data"}
				>
					<span class="mr-1 text-gray-400">◀</span>
					{leftLabel || "Party Data"}
				</div>
				{#if leftMinValue !== null && leftMaxValue !== null}
					{@const basePartyColor =
						partyColors[selectedParty] || "#888888"}
					{@const partyQuintileColors = [
						lightenColor(basePartyColor, 0.8),
						lightenColor(basePartyColor, 0.6),
						lightenColor(basePartyColor, 0.4),
						lightenColor(basePartyColor, 0.2),
						basePartyColor,
					]}
					<div
						class="flex items-center justify-center sm:justify-start space-x-1"
					>
						<span class="text-[10px] text-gray-500 w-9 text-right"
							>{formatLegendLabel(leftMinValue)}</span
						>
						<div
							class="flex h-3 flex-grow max-w-[120px] rounded-sm overflow-hidden border border-gray-200"
						>
							{#each partyQuintileColors as color, i (i)}
								<div
									class="flex-1"
									style:background-color={color}
									title={`Quintile ${i + 1}`}
								></div>
							{/each}
						</div>
						<span class="text-[10px] text-gray-500 w-9 text-left"
							>{formatLegendLabel(leftMaxValue)}</span
						>
					</div>
				{:else}
					<div
						class="text-[10px] text-gray-400 italic text-center sm:text-left"
					>
						(No data range)
					</div>
				{/if}
			</div>
			<!-- Right Legend (Metric) -->
			<div class="text-center sm:text-right">
				<div
					class="text-xs font-medium text-gray-700 mb-1 truncate"
					title={rightLabel || "Metric Data"}
				>
					{rightLabel || "Metric Data"}
					<span class="ml-1 text-gray-400">▶</span>
				</div>
				{#if rightMinValue !== null && rightMaxValue !== null}
					<div
						class="flex items-center justify-center sm:justify-end space-x-1"
					>
						<span class="text-[10px] text-gray-500 w-9 text-right"
							>{formatLegendLabel(rightMinValue)}</span
						>
						<div
							class="flex h-3 flex-grow max-w-[120px] rounded-sm overflow-hidden border border-gray-200"
						>
							{#each metricQuintileColors as color, i (i)}
								<div
									class="flex-1"
									style:background-color={color}
									title={`Quintile ${i + 1}`}
								></div>
							{/each}
						</div>
						<span class="text-[10px] text-gray-500 w-9 text-left"
							>{formatLegendLabel(rightMaxValue)}</span
						>
					</div>
				{:else}
					<div
						class="text-[10px] text-gray-400 italic text-center sm:text-right"
					>
						(No data range)
					</div>
				{/if}
			</div>
			<div
				class="col-span-1 sm:col-span-2 text-center text-[10px] text-gray-400 mt-1"
			>
				Colors show quintiles (approx. 20% bands based on available
				data). Grey indicates no data or zero.
			</div>
		</div>
	{/if}
</div>

<!-- Global Styles for Compare Control - Updated for MapLibre classes -->
<style>
	.debug-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: rgba(0, 0, 0, 0.8);
		color: white;
		padding: 5px;
		font-size: 12px;
		z-index: 9999;
		text-align: center;
	}

	#compare-container {
		position: relative;
		overflow: hidden;
	}
	#compare-container > div[id^="compare-map-"] {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 100%;
		height: 100%;
	}

	/* Style the main swiper line using the user's preferred style */
	:global(#compare-container .maplibregl-compare) {
		background-color: rgba(107, 114, 128, 0.5); /* gray-500 with opacity */
		box-shadow: none;
		border: none;
		width: 2px !important; /* Override default */
		height: 100% !important; /* Override default */
		z-index: 10;
	}

	/* Style the handle using the user's preferred style */
	:global(#compare-container .maplibregl-compare .compare-swiper-vertical),
	:global(#compare-container .maplibregl-compare .compare-swiper-horizontal) {
		width: 36px !important; /* Override default */
		height: 36px !important; /* Override default */
		background-color: rgba(
			255,
			255,
			255,
			0.85
		) !important; /* Override default blue */
		background-image: none !important; /* Remove default SVG arrows */
		border-radius: 50% !important; /* Override default */
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.05),
			0 1px 3px rgba(0, 0, 0, 0.1) !important; /* Override default */
		border: 1px solid rgba(0, 0, 0, 0.1);
		cursor: ew-resize; /* Keep ew-resize for vertical swiper */
		/* Center the handle on the line */
		top: 50%;
		left: 50%; /* Centered horizontally within the line */
		transform: translate(-50%, -50%); /* Precise centering */
		margin: 0 !important; /* Reset margins */
	}
	/* Adjust cursor for horizontal swiper handle */
	:global(#compare-container .maplibregl-compare .compare-swiper-horizontal) {
		cursor: ns-resize;
	}

	/* Add custom arrows using pseudo-elements */
	:global(
			#compare-container
				.maplibregl-compare
				.compare-swiper-vertical::before
		),
	:global(
			#compare-container
				.maplibregl-compare
				.compare-swiper-vertical::after
		) {
		content: "";
		position: absolute;
		width: 0;
		height: 0;
		border-style: solid;
		top: 50%;
		transform: translateY(-50%); /* Center vertically */
	}
	:global(
			#compare-container
				.maplibregl-compare
				.compare-swiper-vertical::before
		) {
		/* Left arrow */
		border-width: 4px 5px 4px 0;
		border-color: transparent #6b7280 transparent transparent; /* gray-500 */
		left: 7px;
	}
	:global(
			#compare-container
				.maplibregl-compare
				.compare-swiper-vertical::after
		) {
		/* Right arrow */
		border-width: 4px 0 4px 5px;
		border-color: transparent transparent transparent #6b7280; /* gray-500 */
		right: 7px;
	}

	/* Add custom arrows for horizontal swiper */
	:global(
			#compare-container
				.maplibregl-compare
				.compare-swiper-horizontal::before
		),
	:global(
			#compare-container
				.maplibregl-compare
				.compare-swiper-horizontal::after
		) {
		content: "";
		position: absolute;
		width: 0;
		height: 0;
		border-style: solid;
		left: 50%;
		transform: translateX(-50%); /* Center horizontally */
	}
	:global(
			#compare-container
				.maplibregl-compare
				.compare-swiper-horizontal::before
		) {
		/* Top arrow */
		border-width: 0 4px 5px 4px; /* left/right bottom left/right */
		border-color: transparent transparent #6b7280 transparent; /* gray-500 */
		top: 7px;
	}
	:global(
			#compare-container
				.maplibregl-compare
				.compare-swiper-horizontal::after
		) {
		/* Bottom arrow */
		border-width: 5px 4px 0 4px;
		border-color: #6b7280 transparent transparent transparent; /* gray-500 */
		bottom: 7px;
	}

	.relative {
		position: relative;
	}

	/* Fade in maps */
	.opacity-0 {
		opacity: 0;
	}
	.transition-opacity {
		transition-property: opacity;
	}
	.duration-500 {
		transition-duration: 500ms;
	}
	.ease-in-out {
		transition-timing-function: ease-in-out;
	}
</style>
