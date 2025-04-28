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
		Popup, // Import Popup
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
	export let mapboxAccessToken: string; // Keep prop name for compatibility if needed elsewhere
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

	// --- Variables to hold dynamically imported modules/classes ---
	let maplibregl: typeof import("maplibre-gl") | null = null;
	let MaplibreCompare: any = null;
	let MaplibrePopup: typeof Popup | null = null; // For Popup class

	// Legend state
	let leftLabel: string = "";
	let leftMinValue: number | null = null;
	let leftMaxValue: number | null = null;
	let rightLabel: string = "";
	let rightMinValue: number | null = null;
	let rightMaxValue: number | null = null;

	// Hover state
	let leftPopup: Popup | null = null;
	let rightPopup: Popup | null = null;
	let hoveredLeftId: string | number | null = null;
	let hoveredRightId: string | number | null = null;

	// Tracking previous values
	let prevSelectedParty = selectedParty;
	let prevSelectedMetric = selectedMetric;
	let prevHighlight = highlightedConstituency;
	let prevDataLength = data?.length ?? 0;

	let customPopupVisible = false;
	let customPopupContent = "";
	let customPopupPosition = { x: 0, y: 0 };
	let containerRect: DOMRect | null = null;
	let compareContainerElement: HTMLElement;

	// Replace the hover handlers with custom tooltip logic
	function handleMouseMove(
		map: MaplibreMap,
		e: MapMouseEvent,
		isLeftMap: boolean
	) {
		if (!e.features || e.features.length === 0) return;

		map.getCanvas().style.cursor = "pointer";
		const feature = e.features[0];
		const featureId = feature.id;

		// Update hovered ID tracking
		if (
			(isLeftMap && featureId === hoveredLeftId) ||
			(!isLeftMap && featureId === hoveredRightId)
		) {
			return; // Same feature, just update position
		}

		if (isLeftMap) {
			hoveredLeftId = featureId;
		} else {
			hoveredRightId = featureId;
		}

		const name = feature.properties?.[FEATURE_NAME_PROPERTY];
		const code = feature.properties?.[FEATURE_ID_PROPERTY];

		const constituencyData = data.find((d) => d.const_code === code);
		const selectedKey = isLeftMap ? selectedParty : selectedMetric;
		const label = isLeftMap ? leftLabel : rightLabel;
		const value = constituencyData
			? getNumericValue(constituencyData, selectedKey)
			: null;
		const formattedValue = formatLegendLabel(value, label);

		// Create popup content
		customPopupContent = `
      <div class="custom-map-tooltip">
        <strong class="block text-xs font-medium mb-0.5">${name || "Unknown"}</strong>
        <span class="block text-[11px] text-gray-600">${label.split("(")[0].trim()}: ${formattedValue}</span>
      </div>`;

		// Get container position once if not already done
		if (!containerRect) {
			containerRect = compareContainerElement.getBoundingClientRect();
		}

		// Calculate position relative to container
		customPopupPosition = {
			x: e.point.x,
			y: e.point.y,
		};

		customPopupVisible = true;
	}

	function handleMouseLeave(map: MaplibreMap, isLeftMap: boolean) {
		map.getCanvas().style.cursor = "";
		if (isLeftMap) {
			hoveredLeftId = null;
		} else {
			hoveredRightId = null;
		}
		customPopupVisible = false;
	}

	// Shared constants
	const SOURCE_ID_LEFT = "constituencies-source-left";
	const LAYER_ID_LEFT = "constituency-fills-left";
	const SOURCE_ID_RIGHT = "constituencies-source-right";
	const LAYER_ID_RIGHT = "constituency-fills-right";
	const SOURCE_LAYER = "uk-constituencies";
	const FEATURE_ID_PROPERTY = "PCON24CD"; // ID property in vector tiles
	const FEATURE_NAME_PROPERTY = "PCON24NM"; // Name property in vector tiles
	const NO_DATA_COLOR = "#e0e0e0";

	// --- Map Initialization Options ---
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

	// --- formatLegendLabel helper (MODIFIED) ---
	function formatLegendLabel(value: number | null, label: string): string {
		if (value === null || value === undefined) return "N/A";
		const numValue = Number(value);
		if (isNaN(numValue)) return "N/A";
		// Use the provided label for context
		if (label.includes("(%)") || label.includes("Voteshare")) {
			// Handle potential 0-1 range if label doesn't explicitly have % but implies it
			if (numValue >= 0 && numValue <= 1 && !label.includes("%")) {
				return `${(numValue * 100).toFixed(1)}%`;
			}
			return `${numValue.toFixed(1)}%`;
		}
		if (label.includes("(£)")) {
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

	// --- Add Source and Layer (Reduced Logging) ---
	async function addSourceAndLayer(
		mapInstance: MaplibreMap,
		sourceId: string,
		layerId: string
	): Promise<void> {
		// console.log(`Starting addSourceAndLayer for ${sourceId}/${layerId}`);
		return new Promise((resolve, reject) => {
			try {
				if (!mapInstance.getSource(sourceId)) {
					// console.log(`Adding vector tile source ${sourceId}`);
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
							// console.log(`Source ${sourceId} loaded via event!`);
							mapInstance.off("sourcedata", checkSourceLoaded);
							addLayersAndResolve();
						}
					};
					mapInstance.on("sourcedata", checkSourceLoaded);

					if (mapInstance.isSourceLoaded(sourceId)) {
						// console.log(`Source ${sourceId} was loaded immediately`);
						mapInstance.off("sourcedata", checkSourceLoaded);
						addLayersAndResolve();
					}
				} else {
					// console.log(`Source ${sourceId} already exists, proceeding to layers`);
					addLayersAndResolve();
				}

				function addLayersAndResolve() {
					if (!mapInstance.getLayer(layerId)) {
						// console.log(`Adding main fill layer ${layerId}`);
						mapInstance.addLayer({
							id: layerId,
							type: "fill",
							source: sourceId,
							"source-layer": SOURCE_LAYER,
							paint: {
								"fill-color": NO_DATA_COLOR,
								"fill-opacity": 0.75,
								"fill-outline-color": "rgba(0,0,0,0.1)", // Simplified outline
							},
						});

						// console.log(`Adding outline layer ${layerId}-highlight-outline`);
						mapInstance.addLayer({
							id: `${layerId}-highlight-outline`,
							type: "line",
							source: sourceId,
							"source-layer": SOURCE_LAYER,
							paint: {
								"line-color": "#000000",
								"line-width": 2.5,
								"line-opacity": 0, // Initially hidden
							},
							filter: ["==", FEATURE_ID_PROPERTY, ""], // Initially filter out everything
						});
					} else {
						// console.log(`Layer ${layerId} already exists`);
					}
					// console.log(`Resolving addSourceAndLayer for ${layerId}`);
					resolve();
				}

				// Safety timeout
				setTimeout(() => {
					if (!mapInstance.getSource(sourceId)) {
						console.error(
							`Source ${sourceId} failed to load within timeout!`
						);
						reject(
							new Error(
								`Source ${sourceId} failed to load within timeout`
							)
						);
					} else if (!mapInstance.getLayer(layerId)) {
						console.warn(
							`Adding layers for ${layerId} via timeout fallback`
						);
						addLayersAndResolve(); // Attempt to add layers anyway
					}
				}, 5000); // Slightly longer timeout
			} catch (error) {
				console.error(
					`Critical error in addSourceAndLayer for ${layerId}:`,
					error
				);
				reject(error);
			}
		});
	}

	// --- Helper to update feature states (Reduced Logging) ---
	function updateFeatureStates(
		mapInstance: MaplibreMap | null,
		sourceId: string,
		variableKey: string,
		variableType: "party" | "metric"
	): boolean {
		// console.log(`updateFeatureStates for ${sourceId}, key: ${variableKey}, type: ${variableType}`);
		if (!mapInstance || !mapInstance.isStyleLoaded()) {
			// console.warn(`updateFeatureStates: map or style not ready for ${sourceId}`);
			return false;
		}
		if (!mapInstance.getSource(sourceId)) {
			// console.warn(`updateFeatureStates: source ${sourceId} not found`);
			return false;
		}
		if (!data || data.length === 0 || !variableKey) {
			// console.warn(`updateFeatureStates: no data or variableKey`);
			return false;
		}

		const validValues: number[] = [];
		const featureData: {
			[code: string]: { value: number | null; name: string };
		} = {};

		data.forEach((d) => {
			const code = d.const_code;
			const name = d.constituency_name;
			if (!code || !name) return;
			const value = getNumericValue(d, variableKey);
			featureData[code] = { value, name };
			if (value !== null && isFinite(value) && value >= 0) {
				validValues.push(value);
			}
		});

		const currentMinValue =
			validValues.length > 0 ? Math.min(...validValues) : null;
		const currentMaxValue =
			validValues.length > 0 ? Math.max(...validValues) : null;

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

		// Set feature states (only need highlight now, value is used by paint)
		let featuresUpdated = 0;
		let featuresMissing = 0;
		Object.entries(featureData).forEach(([code, { name }]) => {
			const isHighlighted = name === highlightedConstituency;
			try {
				// Check if feature exists before setting state (optional but safer)
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
						{ highlighted: isHighlighted } // Only set highlight state
					);
					featuresUpdated++;
				} else {
					featuresMissing++;
				}
			} catch (e) {
				// console.warn(`Error setting feature state for ${code}: ${e.message}`);
			}
		});
		// console.log(`Feature states updated: ${featuresUpdated}, missing: ${featuresMissing}`);
		return featuresUpdated > 0;
	}

	// --- Update paint expression (Reduced Logging) ---
	function updatePaintExpression(
		mapInstance: MaplibreMap | null,
		layerId: string,
		variableType: "party" | "metric",
		variableKey: string
	) {
		// console.log(`updatePaintExpression for ${layerId}, key: ${variableKey}, type: ${variableType}`);
		if (
			!mapInstance ||
			!mapInstance.isStyleLoaded() ||
			!mapInstance.getLayer(layerId)
		) {
			// console.warn(`updatePaintExpression: conditions not met for ${layerId}`);
			return;
		}

		const values: number[] = [];
		data.forEach((d) => {
			const value = getNumericValue(d, variableKey);
			if (value !== null && isFinite(value) && value >= 0) {
				values.push(value);
			}
		});
		values.sort((a, b) => a - b);

		const matchExpression: any[] = ["match", ["id"]]; // Use feature ID directly

		const codeToValue: { [code: string]: number } = {};
		data.forEach((d) => {
			const code = d.const_code;
			const value = getNumericValue(d, variableKey);
			if (code && value !== null && isFinite(value) && value >= 0) {
				codeToValue[code] = value;
			}
		});

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
		} else {
			colorSteps = [
				"#ffffd9",
				"#c7e9b4",
				"#7fcdbb",
				"#41b6c4",
				"#225ea8",
			];
		}

		let quintiles: number[] = [];
		if (values.length >= 5) {
			const p = (percent: number) => {
				const index = Math.floor((percent / 100) * (values.length - 1));
				return values[index];
			};
			quintiles = [p(20), p(40), p(60), p(80)];
		}

		Object.entries(codeToValue).forEach(([code, value]) => {
			let color = NO_DATA_COLOR;
			if (values.length < 2) {
				color = NO_DATA_COLOR;
			} else if (values.length < 5) {
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
				if (value < quintiles[0]) color = colorSteps[0];
				else if (value < quintiles[1]) color = colorSteps[1];
				else if (value < quintiles[2]) color = colorSteps[2];
				else if (value < quintiles[3]) color = colorSteps[3];
				else color = colorSteps[4];
			}
			matchExpression.push(code, color);
		});

		matchExpression.push(NO_DATA_COLOR); // Default case

		try {
			mapInstance.setPaintProperty(
				layerId,
				"fill-color",
				matchExpression
			);
			// console.log(`Paint properties updated successfully for ${layerId}`);
		} catch (error) {
			console.error(`Error setting paint for ${layerId}:`, error);
			errorMessage = `Map paint error for ${layerId}: ${error.message}`;
		}

		// Update highlight layer filter based on highlightedConstituency
		try {
			const highlightLayerId = `${layerId}-highlight-outline`;
			if (highlightedConstituency) {
				const highlighted = data.find(
					(d) => d.constituency_name === highlightedConstituency
				);
				if (highlighted?.const_code) {
					mapInstance.setFilter(highlightLayerId, [
						"==",
						FEATURE_ID_PROPERTY,
						highlighted.const_code,
					]);
					mapInstance.setPaintProperty(
						highlightLayerId,
						"line-opacity",
						1
					);
				} else {
					// Highlighted name not found, clear filter
					mapInstance.setFilter(highlightLayerId, [
						"==",
						FEATURE_ID_PROPERTY,
						"",
					]);
					mapInstance.setPaintProperty(
						highlightLayerId,
						"line-opacity",
						0
					);
				}
			} else {
				// No highlight, clear filter
				mapInstance.setFilter(highlightLayerId, [
					"==",
					FEATURE_ID_PROPERTY,
					"",
				]);
				mapInstance.setPaintProperty(
					highlightLayerId,
					"line-opacity",
					0
				);
			}
		} catch (e) {
			// console.warn(`Error setting highlight filter: ${e.message}`);
		}
	}

	// --- Main Update Function (Reduced Logging) ---
	function updateCompareMaps(forceUpdate = false) {
		// console.log(`updateCompareMaps ENTRY - force=${forceUpdate}`);
		if (!mapsInitialized || !sourcesAndLayersAdded || !isMapReadyForData) {
			// console.warn(`Exiting updateCompareMaps early - conditions not met`);
			return;
		}
		if (!mapLeft || !mapRight) {
			// console.warn(`Maps not available: left=${!!mapLeft}, right=${!!mapRight}`);
			return;
		}

		errorMessage = null;

		// Update feature states (primarily for highlight now)
		const stateUpdatedLeft = updateFeatureStates(
			mapLeft,
			SOURCE_ID_LEFT,
			selectedParty,
			"party"
		);
		const stateUpdatedRight = updateFeatureStates(
			mapRight,
			SOURCE_ID_RIGHT,
			selectedMetric,
			"metric"
		);

		// Update paint properties
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

		// Force map redraw if needed (less critical now with match expression)
		// mapLeft?.triggerRepaint();
		// mapRight?.triggerRepaint();

		// console.log(`updateCompareMaps EXIT`);
	}

	// --- Lifecycle: onMount ---
	onMount(async () => {
		if (!browser) return;
		console.log("ConstituencyCompareMap: onMount started");
		isLoading = true;
		mapsInitialized = false;
		sourcesAndLayersAdded = false;
		isMapReadyForData = false;

		try {
			// Dynamically import libraries
			const maplibreModule = await import("maplibre-gl");
			maplibregl = maplibreModule.default;
			MaplibrePopup = maplibreModule.Popup; // Get Popup class

			MaplibreCompare = (await import("@maplibre/maplibre-gl-compare"))
				.default;

			if (!maplibregl || !MaplibreCompare || !MaplibrePopup) {
				throw new Error("Failed to load MapLibre libraries");
			}

			mapOptions = {
				style: minimalStyle,
				center: [-2, 54.5],
				zoom: 5,
				minZoom: 4,
				maxZoom: 14,
				pitch: 0,
				bearing: 0,
				pitchWithRotate: false,
				dragRotate: false,
				touchZoomRotate: false,
				attributionControl: false,
			};

			mapLeft = new maplibregl.Map({
				container: mapLeftContainer,
				...mapOptions,
			});
			mapRight = new maplibregl.Map({
				container: mapRightContainer,
				...mapOptions,
			});

			mapLeft.on("error", (e: ErrorEvent) => {
				console.error("Map Left error:", e.error);
				errorMessage = `Left map error: ${e.error?.message || "Unknown error"}`;
			});
			mapRight.on("error", (e: ErrorEvent) => {
				console.error("Map Right error:", e.error);
				errorMessage = `Right map error: ${e.error?.message || "Unknown error"}`;
			});

			await Promise.all([
				new Promise<void>((resolve) => mapLeft!.once("load", resolve)),
				new Promise<void>((resolve) => mapRight!.once("load", resolve)),
			]);
			console.log("Both maps loaded initial style");
			mapsInitialized = true;

			if (!mapLeft || !mapRight) {
				throw new Error("MapLibre maps not initialized after load");
			}

			await Promise.all([
				addSourceAndLayer(mapLeft, SOURCE_ID_LEFT, LAYER_ID_LEFT),
				addSourceAndLayer(mapRight, SOURCE_ID_RIGHT, LAYER_ID_RIGHT),
			]);
			console.log("Sources and layers added to both maps");
			sourcesAndLayersAdded = true;

			await Promise.all([
				new Promise<void>((resolve) => mapLeft!.once("idle", resolve)),
				new Promise<void>((resolve) => mapRight!.once("idle", resolve)),
			]);
			console.log("Both maps are now idle");

			if (mapLeft && mapRight) {
				compareControl = new MaplibreCompare(
					mapLeft,
					mapRight,
					"#compare-container"
				);
				console.log("Compare control initialized");
			} else {
				throw new Error("Maps became unavailable before compare init");
			}

			mapLeftContainer.style.opacity = "1";
			mapRightContainer.style.opacity = "1";

			// --- Event Handlers ---

			// Click Handlers
			mapLeft.on("click", LAYER_ID_LEFT, (e: MapMouseEvent) => {
				if (e.features && e.features.length > 0) {
					const name =
						e.features[0].properties?.[FEATURE_NAME_PROPERTY];
					if (name) dispatch("constituencyClick", { name });
				}
			});
			mapRight.on("click", LAYER_ID_RIGHT, (e: MapMouseEvent) => {
				if (e.features && e.features.length > 0) {
					const name =
						e.features[0].properties?.[FEATURE_NAME_PROPERTY];
					if (name) dispatch("constituencyClick", { name });
				}
			});

			// Replace the hover handlers for left map
			mapLeft.on("mousemove", LAYER_ID_LEFT, (e) =>
				handleMouseMove(mapLeft!, e, true)
			);
			mapLeft.on("mouseleave", LAYER_ID_LEFT, () =>
				handleMouseLeave(mapLeft!, true)
			);

			// Replace the hover handlers for right map
			mapRight.on("mousemove", LAYER_ID_RIGHT, (e) =>
				handleMouseMove(mapRight!, e, false)
			);
			mapRight.on("mouseleave", LAYER_ID_RIGHT, () =>
				handleMouseLeave(mapRight!, false)
			);

			// --- Final Setup ---
			isMapReadyForData = true;
			console.log("Triggering initial updateCompareMaps call");
			updateCompareMaps(true); // Force initial update

			// Schedule a follow-up update slightly later
			setTimeout(() => updateCompareMaps(true), 500);

			isLoading = false;
			console.log("Map initialization complete");
		} catch (error: any) {
			console.error("Error during map setup:", error);
			errorMessage = `Map setup failed: ${error.message || error}`;
			isLoading = false;
			isMapReadyForData = false;
		}
	});

	// --- Lifecycle: onDestroy ---
	onDestroy(() => {
		console.log("onDestroy called, cleaning up maps");
		mapsInitialized = false;
		sourcesAndLayersAdded = false;
		isMapReadyForData = false;

		// Remove popups first
		leftPopup?.remove();
		rightPopup?.remove();

		compareControl?.remove();
		mapLeft?.remove();
		mapRight?.remove();

		mapLeft = null;
		mapRight = null;
		compareControl = null;
		maplibregl = null;
		MaplibreCompare = null;
		MaplibrePopup = null;
		leftPopup = null;
		rightPopup = null;
		console.log("Cleanup complete");
	});

	// --- Reactive Update Logic ---
	$: {
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
			// console.log("Reactive update triggered");
			updateCompareMaps();
			prevDataLength = data?.length ?? 0;
			prevSelectedParty = selectedParty;
			prevSelectedMetric = selectedMetric;
			prevHighlight = highlightedConstituency;
		}
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
							isLoading = true; // Show loading briefly
							// Attempt a more forceful reset if needed
							setTimeout(() => updateCompareMaps(true), 50);
						}
					}}
				>
					Retry
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
		bind:this={compareContainerElement}
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

		<!-- Custom popup that floats above both maps -->
		{#if customPopupVisible}
			<div
				class="custom-popup absolute pointer-events-none z-[1000]"
				style="left: {customPopupPosition.x}px; top: {customPopupPosition.y}px;"
			>
				<div class="custom-popup-content">
					{@html customPopupContent}
				</div>
			</div>
		{/if}
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
						<!-- MODIFIED: Pass leftLabel to formatter -->
						<span class="text-[10px] text-gray-500 w-9 text-right"
							>{formatLegendLabel(leftMinValue, leftLabel)}</span
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
						<!-- MODIFIED: Pass leftLabel to formatter -->
						<span class="text-[10px] text-gray-500 w-9 text-left"
							>{formatLegendLabel(leftMaxValue, leftLabel)}</span
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
						<!-- MODIFIED: Pass rightLabel to formatter -->
						<span class="text-[10px] text-gray-500 w-9 text-right"
							>{formatLegendLabel(
								rightMinValue,
								rightLabel
							)}</span
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
						<!-- MODIFIED: Pass rightLabel to formatter -->
						<span class="text-[10px] text-gray-500 w-9 text-left"
							>{formatLegendLabel(
								rightMaxValue,
								rightLabel
							)}</span
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
				data). Grey indicates no data or zero. Hover for details.
			</div>
		</div>
	{/if}
</div>

<!-- Global Styles for Compare Control & Tooltip -->
<style>
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

	/* Style the main swiper line */
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

	/* Add custom arrows using pseudo-elements (Vertical) */
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

	/* Map Tooltip Styling - Keep for compatibility but we won't use it */
	:global(.maplibregl-popup-content.map-tooltip) {
		background-color: rgba(0, 0, 0, 0.8);
		color: #ffffff;
		padding: 6px 8px; /* Match scatter tooltip padding */
		border-radius: 3px; /* Match scatter tooltip corner radius */
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		font-family: system-ui, sans-serif;
		font-size: 11px; /* Match scatter tooltip body font size */
		line-height: 1.4;
		border: 1px solid rgba(255, 255, 255, 0.1); /* Match scatter tooltip border */
		max-width: 240px; /* Prevent overly wide tooltips */
		pointer-events: none; /* Prevent popup from capturing mouse events */
	}
	:global(.maplibregl-popup-content.map-tooltip strong) {
		font-weight: bold;
		font-size: 12px; /* Slightly larger for title */
	}

	/* NEW CUSTOM POPUP STYLES */
	.custom-popup {
		transform: translate(-50%, -100%);
		margin-top: -5px; /* Small offset from pointer */
		animation: fadeIn 150ms ease-out forwards;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translate(-50%, -90%);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -100%);
		}
	}

	.custom-popup-content {
		background-color: white;
		color: #333;
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		padding: 8px 10px;
		font-size: 12px;
		max-width: 240px;
		border: 1px solid rgba(0, 0, 0, 0.1);
		position: relative;
	}

	/* Optional: Add a small arrow/tip at the bottom */
	.custom-popup-content::after {
		content: "";
		position: absolute;
		bottom: -5px;
		left: 50%;
		transform: translateX(-50%);
		width: 0;
		height: 0;
		border-left: 5px solid transparent;
		border-right: 5px solid transparent;
		border-top: 5px solid white;
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1));
	}

	/* Style for the title in popup */
	:global(.custom-map-tooltip strong) {
		display: block;
		font-weight: 600;
		margin-bottom: 2px;
		font-size: 12px;
	}

	/* Style for the value in popup */
	:global(.custom-map-tooltip span) {
		display: block;
		color: #666;
		font-size: 11px;
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
