<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { browser } from "$app/environment";
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
		Popup,
		GeoJSONGeometry,
		NavigationControl,
	} from "maplibre-gl";

	import {
		type ConstituencyData,
		type MetricOption,
		type PartyOption,
	} from "$lib/components/scatter/chartConfig";
	import { getNumericValue } from "$lib/components/scatter/utils";
	import { formatLegendLabel } from "$lib/components/scatter/ChartUtils";

	// Import sub-components
	import MapTooltip from "./MapTooltip.svelte";
	import MapLegend from "./MapLegend.svelte";
	import MapErrorOverlay from "./MapErrorOverlay.svelte";

	// Import constants
	import {
		SOURCE_ID_LEFT,
		LAYER_ID_LEFT,
		SOURCE_ID_RIGHT,
		LAYER_ID_RIGHT,
		SOURCE_LAYER,
		FEATURE_ID_PROPERTY,
		FEATURE_NAME_PROPERTY,
		NO_DATA_COLOR,
		metricQuintileColors,
		partyQuintileColors,
		UK_DEFAULT_CENTER,
		UK_DEFAULT_ZOOM,
		minimalStyle,
	} from "./MapConstants";

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
	let navControlLeft: NavigationControl | null = null; // Navigation control instance
	let navControlRight: NavigationControl | null = null; // Navigation control instance
	let isLoading: boolean = true;
	let errorMessage: string | null = null;
	let mapsInitialized = false;
	let sourcesAndLayersAdded = false;
	let isMapReadyForData = false;

	// --- Variables to hold dynamically imported modules/classes ---
	let maplibregl: typeof import("maplibre-gl") | null = null;
	let MaplibreCompare: any = null;
	let MaplibrePopup: typeof Popup | null = null; // For Popup class
	let MaplibreNavigationControl: typeof NavigationControl | null = null; // For NavigationControl

	// Legend state
	let leftLabel: string = "";
	let leftMinValue: number | null = null;
	let leftMaxValue: number | null = null;
	let rightLabel: string = "";
	let rightMinValue: number | null = null;
	let rightMaxValue: number | null = null;

	// Hover state
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

	let compareControlInitialized = false;

	// --- Helper function to calculate bounds of a GeoJSON geometry ---
	function calculateBounds(
		geometry: GeoJSONGeometry
	): LngLatBoundsLike | null {
		if (!geometry || !geometry.coordinates) return null;

		let minLng = Infinity;
		let maxLng = -Infinity;
		let minLat = Infinity;
		let maxLat = -Infinity;

		const processRing = (ring: number[][]) => {
			ring.forEach(([lng, lat]) => {
				// Basic validation for coordinates
				if (
					typeof lng === "number" &&
					typeof lat === "number" &&
					isFinite(lng) &&
					isFinite(lat) &&
					lng >= -180 &&
					lng <= 180 &&
					lat >= -90 &&
					lat <= 90
				) {
					minLng = Math.min(minLng, lng);
					maxLng = Math.max(maxLng, lng);
					minLat = Math.min(minLat, lat);
					maxLat = Math.max(maxLat, lat);
				}
			});
		};

		try {
			if (geometry.type === "Polygon") {
				if (geometry.coordinates.length > 0) {
					processRing(geometry.coordinates[0]); // Process only the outer ring for bounds
				}
			} else if (geometry.type === "MultiPolygon") {
				geometry.coordinates.forEach((polygon) => {
					if (polygon.length > 0) {
						processRing(polygon[0]); // Process outer ring of each polygon part
					}
				});
			} else {
				return null;
			}
		} catch (error) {
			console.error("Error processing geometry coordinates:", error);
			return null;
		}

		if (
			!isFinite(minLng) ||
			!isFinite(maxLng) ||
			!isFinite(minLat) ||
			!isFinite(maxLat)
		) {
			return null; // Invalid bounds
		}

		// Ensure min/max are slightly different if the feature is effectively a point or line
		if (minLng === maxLng) {
			maxLng += 0.001; // Add small offset
			minLng -= 0.001;
		}
		if (minLat === maxLat) {
			maxLat += 0.001;
			minLat -= 0.001;
		}

		return [
			[minLng, minLat],
			[maxLng, maxLat],
		];
	}

	// --- Zoom Logic Helper ---
	function zoomToBounds(bounds: LngLatBoundsLike | null) {
		if (bounds && mapLeft && mapRight) {
			const options = {
				padding: 60, // Increased padding for better framing
				maxZoom: 11.5, // Allow slightly closer zoom
				duration: 800, // Animation duration
				essential: true, // Ensure animation runs
			};
			// Fit bounds on both maps to keep them in sync
			mapLeft.fitBounds(bounds, options);
			mapRight.fitBounds(bounds, options);
			return true;
		}
		return false;
	}

	// --- Zoom and Click Handling ---
	function handleConstituencyClick(e: MapMouseEvent) {
		if (e.features && e.features.length > 0) {
			const feature = e.features[0];
			const name = feature.properties?.[FEATURE_NAME_PROPERTY];

			// Dispatch event for external components
			if (name) dispatch("constituencyClick", { name });

			// Calculate bounds and zoom using the helper
			const bounds = calculateBounds(feature.geometry);
			if (!zoomToBounds(bounds)) {
				console.warn(
					"Could not calculate bounds or zoom for clicked feature:",
					feature
				);
			}
		}
	}

	// --- EXPORTED FUNCTION for external zooming ---
	export function zoomToConstituency(name: string) {
		if (!mapLeft || !mapRight || !data || data.length === 0) {
			console.warn("Map not ready or no data for zooming.");
			return;
		}

		const constituency = data.find((d) => d.constituency_name === name);
		if (!constituency || !constituency.const_code) {
			console.warn(`Constituency '${name}' not found in data.`);
			return;
		}

		const code = constituency.const_code;

		// Query the source features to get the geometry
		// Query either map, assuming sources are identical
		const features = mapLeft.querySourceFeatures(SOURCE_ID_LEFT, {
			sourceLayer: SOURCE_LAYER,
			filter: ["==", FEATURE_ID_PROPERTY, code],
		});

		if (features && features.length > 0) {
			const bounds = calculateBounds(features[0].geometry);
			if (!zoomToBounds(bounds)) {
				console.warn(
					`Could not calculate bounds or zoom for constituency: ${name}`
				);
			}
		} else {
			console.warn(
				`Could not find feature geometry for constituency code: ${code}`
			);
		}
	}

	// Replace the hover handlers with custom tooltip logic
	function handleMouseMove(
		map: MaplibreMap,
		e: MapMouseEvent,
		isLeftMap: boolean
	) {
		if (!e.features || e.features.length === 0) {
			// If moving off a feature but still over the map layer, hide tooltip
			if (
				(isLeftMap && hoveredLeftId !== null) ||
				(!isLeftMap && hoveredRightId !== null)
			) {
				handleMouseLeave(map, isLeftMap);
			}
			return;
		}

		map.getCanvas().style.cursor = "pointer";
		const feature = e.features[0];
		const featureId = feature.id;

		// Update hovered ID tracking
		if (
			(isLeftMap && featureId === hoveredLeftId) ||
			(!isLeftMap && featureId === hoveredRightId)
		) {
			// Same feature, just update position
			if (!containerRect) {
				containerRect = compareContainerElement.getBoundingClientRect();
			}
			customPopupPosition = {
				x: e.point.x,
				y: e.point.y,
			};
			return;
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
			if (hoveredLeftId !== null) {
				hoveredLeftId = null;
				customPopupVisible = false; // Hide only if this map's feature was hovered
			}
		} else {
			if (hoveredRightId !== null) {
				hoveredRightId = null;
				customPopupVisible = false; // Hide only if this map's feature was hovered
			}
		}
		// If both are null, ensure it's hidden (covers edge cases)
		if (hoveredLeftId === null && hoveredRightId === null) {
			customPopupVisible = false;
		}
	}

	// --- Add Source and Layer (Reduced Logging) ---
	async function addSourceAndLayer(
		mapInstance: MaplibreMap,
		sourceId: string,
		layerId: string
	): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
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
							addLayersAndResolve();
						}
					};
					mapInstance.on("sourcedata", checkSourceLoaded);

					if (mapInstance.isSourceLoaded(sourceId)) {
						mapInstance.off("sourcedata", checkSourceLoaded);
						addLayersAndResolve();
					}
				} else {
					addLayersAndResolve();
				}

				function addLayersAndResolve() {
					if (!mapInstance.getLayer(layerId)) {
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
					}
					resolve();
				}

				// Safety timeout
				setTimeout(() => {
					if (!mapInstance.getSource(sourceId)) {
						reject(
							new Error(
								`Source ${sourceId} failed to load within timeout`
							)
						);
					} else if (!mapInstance.getLayer(layerId)) {
						addLayersAndResolve(); // Attempt to add layers anyway
					}
				}, 5000); // Slightly longer timeout
			} catch (error) {
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
		if (!mapInstance || !mapInstance.isStyleLoaded()) {
			return false;
		}
		if (!mapInstance.getSource(sourceId)) {
			return false;
		}
		if (!data || data.length === 0 || !variableKey) {
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
				// Silently handle errors
			}
		});
		return featuresUpdated > 0;
	}

	// --- Update paint expression (Reduced Logging) ---
	function updatePaintExpression(
		mapInstance: MaplibreMap | null,
		layerId: string,
		variableType: "party" | "metric",
		variableKey: string
	) {
		if (
			!mapInstance ||
			!mapInstance.isStyleLoaded() ||
			!mapInstance.getLayer(layerId)
		) {
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

		let colorSteps: string[];
		if (variableType === "party") {
			// Party map: Green to Purple diverging scheme
			colorSteps = partyQuintileColors;
		} else {
			// Metric map: Red to Blue diverging scheme
			colorSteps = metricQuintileColors;
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

			// Check if value is exactly 0, treat as NO_DATA
			if (value === 0) {
				color = NO_DATA_COLOR;
			} else if (values.length < 2) {
				// Not enough data for a range
				color = NO_DATA_COLOR;
			} else if (values.length < 5) {
				// Less than 5 points, use simple interpolation (might look odd with diverging)
				if (values[values.length - 1] <= values[0]) {
					// All values are the same, use the middle color (or no data)
					color = colorSteps[2]; // Middle color
				} else {
					const min = values[0];
					const max = values[values.length - 1];
					const ratio = Math.max(
						0,
						Math.min(1, (value - min) / (max - min))
					);
					// Map ratio to the 5 color steps
					const colorIndex = Math.min(4, Math.floor(ratio * 5));
					color = colorSteps[colorIndex];
				}
			} else {
				// Use quintiles for 5+ data points
				if (value < quintiles[0]) color = colorSteps[0];
				else if (value < quintiles[1]) color = colorSteps[1];
				else if (value < quintiles[2]) color = colorSteps[2];
				else if (value < quintiles[3]) color = colorSteps[3];
				else color = colorSteps[4];
			}
			matchExpression.push(code, color);
		});

		matchExpression.push(NO_DATA_COLOR); // Default case for unmatched IDs or null values

		try {
			mapInstance.setPaintProperty(
				layerId,
				"fill-color",
				matchExpression
			);
		} catch (error: any) {
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
		} catch (e: any) {
			// Silent error handling
		}
	}

	// --- Main Update Function (Reduced Logging) ---
	function updateCompareMaps(forceUpdate = false) {
		if (!mapsInitialized || !sourcesAndLayersAdded || !isMapReadyForData) {
			return;
		}
		if (!mapLeft || !mapRight) {
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
	}

	// --- Lifecycle: onMount ---
	onMount(async () => {
		if (!browser) return;
		console.log("ConstituencyCompareMap: onMount started");
		isLoading = true;
		mapsInitialized = false;
		sourcesAndLayersAdded = false;
		isMapReadyForData = false;
		compareControlInitialized = false; // Reset flag on mount

		try {
			// Dynamically import libraries
			const maplibreModule = await import("maplibre-gl");
			maplibregl = maplibreModule.default;
			MaplibrePopup = maplibreModule.Popup; // Get Popup class
			MaplibreNavigationControl = maplibreModule.NavigationControl; // Get NavigationControl class

			MaplibreCompare = (await import("@maplibre/maplibre-gl-compare"))
				.default;

			if (
				!maplibregl ||
				!MaplibreCompare ||
				!MaplibrePopup ||
				!MaplibreNavigationControl
			) {
				throw new Error("Failed to load MapLibre libraries");
			}

			const mapOptions: Omit<MapOptions, "container"> = {
				style: minimalStyle,
				center: UK_DEFAULT_CENTER as LngLatLike,
				zoom: UK_DEFAULT_ZOOM,
				minZoom: 4,
				maxZoom: 14, // Increased max zoom slightly
				pitch: 0,
				bearing: 0,
				pitchWithRotate: false,
				dragRotate: false,
				touchZoomRotate: false,
				attributionControl: false,
				maxBounds: [
					[-25, 49], // Southwest coordinates (left, bottom)
					[20, 61], // Northeast coordinates (right, top)
				] as LngLatBoundsLike,
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

			// Add Navigation Controls
			navControlLeft = new MaplibreNavigationControl({
				showCompass: false,
				showZoom: true,
			});
			navControlRight = new MaplibreNavigationControl({
				showCompass: false,
				showZoom: true,
			});
			mapLeft.addControl(navControlLeft, "top-right");
			mapRight.addControl(navControlRight, "top-right");

			// Add interaction handlers
			mapLeft.on("click", LAYER_ID_LEFT, handleConstituencyClick);
			mapRight.on("click", LAYER_ID_RIGHT, handleConstituencyClick);

			mapLeft.on("mousemove", LAYER_ID_LEFT, (e) =>
				handleMouseMove(mapLeft, e, true)
			);
			mapRight.on("mousemove", LAYER_ID_RIGHT, (e) =>
				handleMouseMove(mapRight, e, false)
			);

			mapLeft.on("mouseleave", LAYER_ID_LEFT, () =>
				handleMouseLeave(mapLeft, true)
			);
			mapRight.on("mouseleave", LAYER_ID_RIGHT, () =>
				handleMouseLeave(mapRight, false)
			);

			// Wait for maps to load initial style
			await Promise.all([
				new Promise<void>((resolve) => mapLeft!.once("load", resolve)),
				new Promise<void>((resolve) => mapRight!.once("load", resolve)),
			]);
			console.log("Both maps loaded initial style");
			mapsInitialized = true;

			if (!mapLeft || !mapRight) {
				throw new Error("MapLibre maps not initialized after load");
			}

			// Add sources and layers
			await Promise.all([
				addSourceAndLayer(mapLeft, SOURCE_ID_LEFT, LAYER_ID_LEFT),
				addSourceAndLayer(mapRight, SOURCE_ID_RIGHT, LAYER_ID_RIGHT),
			]);
			console.log("Sources and layers added to both maps");
			sourcesAndLayersAdded = true;

			// Wait for maps to be idle *after* sources/layers are added
			await Promise.all([
				new Promise<void>((resolve) => mapLeft!.once("idle", resolve)),
				new Promise<void>((resolve) => mapRight!.once("idle", resolve)),
			]);
			console.log("Both maps are now idle");

			// Initialize Compare Control
			if (mapLeft && mapRight) {
				compareControl = new MaplibreCompare(
					mapLeft,
					mapRight,
					compareContainerElement // Use the bound element
				);
				console.log("Compare control initialized");

				// --- MODIFICATION START ---
				// Center slider ONLY on the very first initialization
				if (!compareControlInitialized) {
					// Use requestAnimationFrame to wait for the next paint cycle
					requestAnimationFrame(() => {
						// Use a short timeout to ensure the control is fully ready
						setTimeout(() => {
							if (compareControl) {
								// Check if control still exists
								// Dispatch resize event to trigger centering calculation
								window.dispatchEvent(new Event("resize"));
								console.log(
									"Dispatched resize event for initial compare control centering."
								);
								// Set the flag *after* the resize logic has been triggered
								compareControlInitialized = true;
							}
						}, 100); // Slightly increased delay to 100ms
					});
				}
			} else {
				throw new Error("Maps became unavailable before compare init");
			}

			// Fade in maps
			mapLeftContainer.style.opacity = "1";
			mapRightContainer.style.opacity = "1";

			// --- Final Setup ---
			isMapReadyForData = true;
			console.log("Triggering initial updateCompareMaps call");
			updateCompareMaps(true); // Force initial update

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
		compareControlInitialized = false;

		// Remove controls first
		if (navControlLeft && mapLeft) mapLeft.removeControl(navControlLeft);
		if (navControlRight && mapRight)
			mapRight.removeControl(navControlRight);
		compareControl?.remove();

		// Remove maps
		mapLeft?.remove();
		mapRight?.remove();

		// Nullify references
		mapLeft = null;
		mapRight = null;
		compareControl = null;
		navControlLeft = null;
		navControlRight = null;
		maplibregl = null;
		MaplibreCompare = null;
		MaplibrePopup = null;
		MaplibreNavigationControl = null;
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
			updateCompareMaps();
			prevDataLength = data?.length ?? 0;
			prevSelectedParty = selectedParty;
			prevSelectedMetric = selectedMetric;
			prevHighlight = highlightedConstituency;
		}
	}

	// Listen for retry events
	function handleRetry() {
		if (mapLeft && mapRight) {
			errorMessage = null;
			isLoading = true; // Show loading briefly
			// Attempt a more forceful reset
			setTimeout(() => updateCompareMaps(true), 50);
			isLoading = false;
		}
	}

	// Set up listener when component is mounted
	$: if (browser) {
		window.addEventListener("retry", handleRetry);
	}
</script>

<!-- HTML Template -->
<div
	class="relative font-sans border border-gray-200/75 rounded-lg bg-white overflow-hidden shadow-sm"
>
	<!-- Error/Loading Overlays -->
	<MapErrorOverlay {errorMessage} {isLoading} />
	<!-- Removed on:retry here, handled globally -->

	<!-- Container for the Compare Control -->
	<div
		bind:this={compareContainerElement}
		id="compare-container"
		class="relative w-full h-[450px] sm:h-[500px] md:h-[550px] rounded-t-lg overflow-hidden bg-gray-100 {isLoading ||
		errorMessage
			? 'opacity-50 blur-[2px] pointer-events-none'
			: ''} transition-all duration-200"
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
		<MapTooltip
			visible={customPopupVisible}
			content={customPopupContent}
			position={customPopupPosition}
		/>
	</div>

	<!-- Combined Legend -->
	<MapLegend
		{leftLabel}
		{leftMinValue}
		{leftMaxValue}
		{rightLabel}
		{rightMinValue}
		{rightMaxValue}
		partyColors={partyQuintileColors}
		metricColors={metricQuintileColors}
		{isLoading}
		{errorMessage}
	/>
</div>

<!-- Global Styles for Compare Control & Navigation -->
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
		background-color: rgba(55, 65, 81, 0.4); /* gray-700 with opacity */
		box-shadow: none;
		border: none;
		width: 3px !important; /* Slightly thicker */
		height: 100% !important;
		z-index: 10;
	}

	/* Style the handle */
	:global(#compare-container .maplibregl-compare .compare-swiper-vertical),
	:global(#compare-container .maplibregl-compare .compare-swiper-horizontal) {
		width: 40px !important; /* Slightly larger */
		height: 40px !important;
		background-color: rgba(255, 255, 255, 0.9) !important;
		background-image: none !important;
		border-radius: 50% !important;
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.15),
			0 0 0 1px rgba(0, 0, 0, 0.05) !important;
		border: 1px solid rgba(0, 0, 0, 0.1);
		cursor: ew-resize;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		margin: 0 !important;
		transition: background-color 0.15s ease-in-out;
	}
	:global(
			#compare-container
				.maplibregl-compare
				.compare-swiper-vertical:hover
		),
	:global(
			#compare-container
				.maplibregl-compare
				.compare-swiper-horizontal:hover
		) {
		background-color: rgba(255, 255, 255, 1) !important;
		box-shadow:
			0 2px 5px rgba(0, 0, 0, 0.2),
			0 0 0 1px rgba(0, 0, 0, 0.07) !important;
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
		transform: translateY(-50%);
		transition: border-color 0.15s ease-in-out;
	}
	:global(
			#compare-container
				.maplibregl-compare
				.compare-swiper-vertical::before
		) {
		/* Left arrow */
		border-width: 5px 6px 5px 0; /* Slightly larger */
		border-color: transparent #4b5563 transparent transparent; /* gray-600 */
		left: 8px;
	}
	:global(
			#compare-container
				.maplibregl-compare
				.compare-swiper-vertical::after
		) {
		/* Right arrow */
		border-width: 5px 0 5px 6px;
		border-color: transparent transparent transparent #4b5563; /* gray-600 */
		right: 8px;
	}
	:global(
			#compare-container
				.maplibregl-compare
				.compare-swiper-vertical:hover::before
		) {
		border-color: transparent #1f2937 transparent transparent; /* gray-800 */
	}
	:global(
			#compare-container
				.maplibregl-compare
				.compare-swiper-vertical:hover::after
		) {
		border-color: transparent transparent transparent #1f2937; /* gray-800 */
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
		transform: translateX(-50%);
		transition: border-color 0.15s ease-in-out;
	}
	:global(
			#compare-container
				.maplibregl-compare
				.compare-swiper-horizontal::before
		) {
		/* Top arrow */
		border-width: 0 5px 6px 5px; /* left/right bottom left/right */
		border-color: transparent transparent #4b5563 transparent; /* gray-600 */
		top: 8px;
	}
	:global(
			#compare-container
				.maplibregl-compare
				.compare-swiper-horizontal::after
		) {
		/* Bottom arrow */
		border-width: 6px 5px 0 5px;
		border-color: #4b5563 transparent transparent transparent; /* gray-600 */
		bottom: 8px;
	}
	:global(
			#compare-container
				.maplibregl-compare
				.compare-swiper-horizontal:hover::before
		) {
		border-color: transparent transparent #1f2937 transparent; /* gray-800 */
	}
	:global(
			#compare-container
				.maplibregl-compare
				.compare-swiper-horizontal:hover::after
		) {
		border-color: #1f2937 transparent transparent transparent; /* gray-800 */
	}

	/* Style for the title in popup */
	/* Style for the title in popup */
	:global(.custom-map-tooltip strong) {
		display: block;
		font-weight: 600;
		margin-bottom: 2px;
		font-size: 12px;
		color: #fff; /* Keep title white */
	}

	/* Style for the value in popup - ADJUSTED COLOR */
	:global(.custom-map-tooltip span) {
		display: block;
		/* Use a lighter gray for better contrast on the dark background */
		color: #d1d5db; /* Tailwind's gray-300 */
		font-size: 11px;
	}

	.relative {
		position: relative;
	}

	/* Fade in maps */
	.relative {
		position: relative;
	}
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

	/* Navigation Control Styling */
	:global(.maplibregl-ctrl-top-right) {
		margin: 10px 10px 0 0;
		z-index: 5;
	}
	:global(.maplibregl-ctrl-group) {
		background: #fff !important;
		border-radius: 4px !important;
		box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1) !important;
		border: none !important;
		overflow: hidden;
	}
	:global(.maplibregl-ctrl-group button) {
		width: 30px !important;
		height: 30px !important;
		background-color: transparent !important;
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
		color: #333 !important;
		opacity: 1;
		cursor: pointer;
		transition: background-color 0.1s ease-in-out;
	}
	:global(.maplibregl-ctrl-group button:hover) {
		background-color: #f0f0f0 !important;
		color: #000 !important;
	}
	:global(.maplibregl-ctrl-group button:focus) {
		outline: none;
		box-shadow: none;
	}
	:global(.maplibregl-ctrl-group button:disabled) {
		cursor: not-allowed;
		color: #aaa !important;
		background-color: transparent !important;
	}
	:global(.maplibregl-ctrl-group button + button) {
		border-top: 1px solid rgba(0, 0, 0, 0.1) !important;
	}
	:global(.maplibregl-ctrl-icon) {
		background-image: none !important;
		width: 18px;
		height: 18px;
		background-repeat: no-repeat;
		background-position: center;
		background-size: contain;
	}
	:global(.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 18'%3E%3Cpath fill='%23333' d='M9,4.5a.75.75,0,0,1,.75.75v3h3a.75.75,0,0,1,0,1.5h-3v3a.75.75,0,0,1-1.5,0v-3h-3a.75.75,0,0,1,0-1.5h3v-3A.75.75,0,0,1,9,4.5z'/%3E%3C/svg%3E") !important;
	}
	:global(.maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 18'%3E%3Cpath fill='%23333' d='M4.5,8.25a.75.75,0,0,1,.75-.75h7.5a.75.75,0,0,1,0,1.5h-7.5A.75.75,0,0,1,4.5,8.25z'/%3E%3C/svg%3E") !important;
	}
	:global(
			#compare-container
				.maplibregl-compare-left
				.maplibregl-ctrl-top-right
		) {
		opacity: 0.5;
		pointer-events: none;
	}
	:global(
			#compare-container
				.maplibregl-compare-right
				.maplibregl-ctrl-top-right
		) {
		opacity: 1;
		pointer-events: auto;
	}
</style>
