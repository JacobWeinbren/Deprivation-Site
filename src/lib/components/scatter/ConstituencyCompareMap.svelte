<!-- src/lib/components/ConstituencyCompareMap.svelte -->
<script lang="ts">
	// Import necessary Svelte functions and types
	import { onMount, onDestroy } from "svelte"; // Removed watch
	// Import Mapbox GL library and types
	import mapboxgl from "mapbox-gl";
	import type {
		LngLatLike,
		Expression,
		LngLatBoundsLike,
		StyleSpecification, // Import StyleSpecification type
		MapDataEvent, // Import MapDataEvent type
		MapMouseEvent, // Import MapMouseEvent for event handlers
	} from "mapbox-gl";
	// Import the TYPE for MapboxCompare if needed for type checking
	// Make sure you have installed @types/mapbox-gl-compare
	import type MapboxCompare from "mapbox-gl-compare";

	// Import shared types and utility functions
	import {
		type ConstituencyData,
		type MetricOption,
		type PartyOption,
	} from "./chartConfig";
	import { getNumericValue } from "./utils";

	// --- Props ---
	export let data: ConstituencyData[] = [];
	export let selectedParty: string = ""; // Dependent Variable (Left Map)
	export let selectedMetric: string = ""; // Independent Variable (Right Map)
	export let highlightedConstituency: string | null = null;
	// Use the props for metrics and parties config
	export let metrics: MetricOption[] = [];
	export let parties: PartyOption[] = [];
	export let partyColors: { [key: string]: string } = {}; // Added this prop
	export let mapboxAccessToken: string;
	export let mapIdLeft: string =
		"compare-map-left-" + Math.random().toString(36).substring(2, 9);
	export let mapIdRight: string =
		"compare-map-right-" + Math.random().toString(36).substring(2, 9);

	// --- State ---
	let mapLeftContainer: HTMLDivElement;
	let mapRightContainer: HTMLDivElement;
	let mapLeft: mapboxgl.Map | null = null;
	let mapRight: mapboxgl.Map | null = null;
	// Use InstanceType to get the type of the instance created by the constructor
	let compareControl: InstanceType<typeof MapboxCompare> | null = null;
	let isLoading: boolean = true;
	let errorMessage: string | null = null;
	let isMapReadyForData = false; // Flag for when BOTH maps are ready

	// State for Left Map (Party) Legend
	let leftLabel: string = ""; // Initialize
	let leftMinValue: number | null = null;
	let leftMaxValue: number | null = null;

	// State for Right Map (Metric) Legend
	let rightLabel: string = ""; // Initialize
	let rightMinValue: number | null = null;
	let rightMaxValue: number | null = null;

	// Keep track of previous prop values for reactivity check
	let prevSelectedParty = selectedParty;
	let prevSelectedMetric = selectedMetric;
	let prevHighlight = highlightedConstituency;
	let prevDataLength = data?.length ?? 0;

	// Shared constants
	const SOURCE_ID_LEFT = "constituencies-source-left";
	const LAYER_ID_LEFT = "constituency-fills-left";
	const SOURCE_ID_RIGHT = "constituencies-source-right";
	const LAYER_ID_RIGHT = "constituency-fills-right";
	const SOURCE_LAYER = "uk-constituencies"; // MVT layer name
	const FEATURE_ID_PROPERTY = "PCON24CD";

	// --- Map Initialization Options (Shared) ---
	const bounds: LngLatBoundsLike = [
		[-10.8, 49.5],
		[2.0, 61.0],
	];
	const minimalStyle: StyleSpecification = {
		version: 8,
		sources: {},
		layers: [],
	};
	const mapOptions = {
		style: minimalStyle,
		center: [-2, 54.5] as [number, number], // Explicitly type center
		zoom: 5,
		pitch: 0,
		bearing: 0,
		pitchWithRotate: false,
		dragRotate: false,
		touchZoomRotate: false,
		projection: { name: "mercator" },
		antialias: true,
		// maxBounds: bounds, // Keep commented out to allow panning
	};

	// --- Helper: Add Source and Layer (Simplified Initial Paint) ---
	function addSourceAndLayer(
		mapInstance: mapboxgl.Map,
		sourceId: string,
		layerId: string
	): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				console.log(
					`CompareMap [${layerId}]: Attempting to add source ${sourceId}`
				);
				if (!mapInstance.getSource(sourceId)) {
					mapInstance.addSource(sourceId, {
						type: "vector",
						tiles: [
							"https://map.jacobweinbren.workers.dev/gb-constituencies/{z}/{x}/{y}.mvt",
						],
						promoteId: FEATURE_ID_PROPERTY,
						minzoom: 4,
						maxzoom: 10,
					});
					console.log(
						`CompareMap [${layerId}]: Source ${sourceId} added.`
					);
				} else {
					console.log(
						`CompareMap [${layerId}]: Source ${sourceId} already exists.`
					);
				}

				const noDataColor = "#e0e0e0";

				console.log(
					`CompareMap [${layerId}]: Attempting to add layer ${layerId}`
				);
				if (!mapInstance.getLayer(layerId)) {
					mapInstance.addLayer({
						id: layerId,
						type: "fill",
						source: sourceId,
						"source-layer": SOURCE_LAYER,
						paint: {
							// --- Use simple color initially ---
							"fill-color": noDataColor,
							"fill-opacity": 0.7,
							"fill-outline-color": [
								"case",
								[
									"boolean",
									["feature-state", "highlighted"],
									false,
								],
								"#000000",
								"rgba(255,255,255,0.3)",
							],
						},
					});

					// Add a dedicated outline layer for highlighted constituencies
					mapInstance.addLayer({
						id: `${layerId}-highlight-outline`,
						type: "line",
						source: sourceId,
						"source-layer": SOURCE_LAYER,
						paint: {
							"line-color": "#000000",
							"line-width": 3, // Thicker outline
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

					console.log(`CompareMap [${layerId}]: Layers added.`);
				} else {
					console.log(
						`CompareMap [${layerId}]: Layer ${layerId} already exists.`
					);
				}

				mapInstance.once("idle", () => {
					console.log(
						`CompareMap [${layerId}]: Map idle after addSource/Layer.`
					);
					resolve();
				});
				// Safety timeout
				setTimeout(() => {
					if (
						mapInstance.isStyleLoaded() &&
						mapInstance.getSource(sourceId) &&
						mapInstance.getLayer(layerId)
					) {
						resolve(); // Resolve if ready after timeout
					} else {
						console.warn(
							`CompareMap [${layerId}]: Map instance still not fully ready after timeout.`
						);
						resolve(); // Resolve anyway
					}
				}, 300);
			} catch (error) {
				console.error(
					`Error adding source/layer for ${layerId}:`,
					error
				);
				reject(error);
			}
		});
	}

	// --- Helper function to lighten colors for quintiles ---
	function lightenColor(hex: string, factor: number): string {
		// Remove the # if present
		hex = hex.replace("#", "");

		// Parse the hex values
		let r = parseInt(hex.substring(0, 2), 16);
		let g = parseInt(hex.substring(2, 4), 16);
		let b = parseInt(hex.substring(4, 6), 16);

		// Lighten the color
		r = Math.min(255, Math.round(r + (255 - r) * factor));
		g = Math.min(255, Math.round(g + (255 - g) * factor));
		b = Math.min(255, Math.round(b + (255 - b) * factor));

		// Convert back to hex
		return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
	}

	// --- Helper to only update feature states ---
	function updateFeatureStates(
		mapInstance: mapboxgl.Map | null,
		sourceId: string,
		variableKey: string,
		variableLabel: string, // Keep for potential future use
		variableType: "party" | "metric"
	) {
		if (
			!mapInstance ||
			!mapInstance.getSource(sourceId) ||
			!mapInstance.isStyleLoaded() ||
			!data ||
			data.length === 0 ||
			!variableKey
		) {
			// console.warn(`CompareMap [${sourceId}]: updateFeatureStates skipped - conditions not met.`);
			return false; // Indicate failure
		}

		// Calculate Min/Max for legend update
		const validValues: number[] = [];
		const featureData: {
			[code: string]: { value: number | null; name: string };
		} = {};
		let processedCount = 0;
		data.forEach((d) => {
			const code = d.const_code;
			const name = d.constituency_name;
			if (!code || !name) return;
			const value = getNumericValue(d, variableKey);
			featureData[code] = { value, name };
			if (value !== null && isFinite(value) && value >= 0) {
				validValues.push(value);
				processedCount++;
			}
		});
		const currentMinValue =
			validValues.length > 0
				? Math.min(...validValues)
				: Object.values(featureData).some((f) => f.value === 0)
					? 0
					: null;
		const currentMaxValue =
			validValues.length > 0
				? Math.max(...validValues)
				: Object.values(featureData).some((f) => f.value === 0)
					? 0
					: null;

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
		// console.log(`CompareMap [${sourceId}]: Min/Max calculated: ${currentMinValue} / ${currentMaxValue}`);

		// Iterate and set 'value' and 'highlighted' state
		let stateSetCount = 0;
		Object.entries(featureData).forEach(([code, { value, name }]) => {
			const isHighlighted = name === highlightedConstituency;
			// Ensure value is number or null before setting
			const finalValue =
				typeof value === "number" && isFinite(value) ? value : null;

			// DEBUG: Log state being set for a few sample constituencies
			if (["E14001063", "E14000537", "E14000921"].includes(code)) {
				console.log(
					`CompareMap [${sourceId}]: Setting state for ${code}: value=${finalValue}, highlighted=${isHighlighted}`
				);
			}

			mapInstance.setFeatureState(
				{ source: sourceId, sourceLayer: SOURCE_LAYER, id: code },
				{
					value: finalValue,
					highlighted: isHighlighted,
					constituencyName: name,
				}
			);
			stateSetCount++;
		});
		console.log(
			`CompareMap [${sourceId}]: Feature states updated for ${stateSetCount} features.`
		);
		return true; // Indicate success
	}

	// --- Helper to update paint property expression based on current state/props ---
	function updatePaintExpression(
		mapInstance: mapboxgl.Map | null,
		layerId: string,
		variableType: "party" | "metric",
		variableKey: string
	) {
		if (
			!mapInstance ||
			!mapInstance.getLayer(layerId) ||
			!mapInstance.isStyleLoaded()
		) {
			console.warn(
				`CompareMap [${layerId}]: updatePaintExpression skipped - conditions not met.`
			);
			return;
		}

		const noDataColor = "#e0e0e0";
		let colorExpression: Expression;

		// Get the data points to calculate true quintiles
		const values: number[] = [];
		data.forEach((d) => {
			const value = getNumericValue(d, variableKey);
			if (value !== null && isFinite(value) && value > 0) {
				values.push(value);
			}
		});

		// Sort values for percentile calculation
		values.sort((a, b) => a - b);

		if (values.length < 5) {
			// Not enough data for quintiles
			colorExpression = noDataColor;
		} else {
			// Calculate true quintile boundaries (20th, 40th, 60th, 80th percentiles)
			const quintile1Index = Math.floor(values.length * 0.2);
			const quintile2Index = Math.floor(values.length * 0.4);
			const quintile3Index = Math.floor(values.length * 0.6);
			const quintile4Index = Math.floor(values.length * 0.8);

			const quintile1Value = values[quintile1Index];
			const quintile2Value = values[quintile2Index];
			const quintile3Value = values[quintile3Index];
			const quintile4Value = values[quintile4Index];

			if (variableType === "party") {
				// Party quintile coloring
				const basePartyColor = partyColors[variableKey] || "#E4003B";

				// Create 5 shades from lightest to darkest
				const shade1 = lightenColor(basePartyColor, 0.8);
				const shade2 = lightenColor(basePartyColor, 0.6);
				const shade3 = lightenColor(basePartyColor, 0.4);
				const shade4 = lightenColor(basePartyColor, 0.2);
				const shade5 = basePartyColor;

				colorExpression = [
					"step",
					["to-number", ["feature-state", "value"], values[0]],
					shade1,
					quintile1Value,
					shade2,
					quintile2Value,
					shade3,
					quintile3Value,
					shade4,
					quintile4Value,
					shade5,
				];
			} else {
				// Metric quintile coloring
				colorExpression = [
					"step",
					["to-number", ["feature-state", "value"], values[0]],
					"#ffffd9", // Quintile 1 (lowest)
					quintile1Value,
					"#edf8b1",
					quintile2Value,
					"#b2e2e2",
					quintile3Value,
					"#66c2a4",
					quintile4Value,
					"#2c7fb8", // Quintile 5 (highest)
				];
			}

			// Update the min/max for the legend
			if (variableType === "party") {
				leftMinValue = values[0];
				leftMaxValue = values[values.length - 1];
			} else {
				rightMinValue = values[0];
				rightMaxValue = values[values.length - 1];
			}
		}

		// Wrap with case for null/missing state
		const finalFillColorExpression: Expression = [
			"case",
			["==", ["typeof", ["feature-state", "value"]], "null"],
			noDataColor,
			["==", ["typeof", ["feature-state", "value"]], "undefined"],
			noDataColor,
			["==", ["to-number", ["feature-state", "value"]], 0],
			noDataColor,
			colorExpression,
		];

		try {
			mapInstance.setPaintProperty(
				layerId,
				"fill-color",
				finalFillColorExpression
			);
		} catch (error) {
			console.error(
				`ConstituencyCompareMap: Error setting paint property for ${layerId}:`,
				error
			);
			console.error(
				"Expression was:",
				JSON.stringify(finalFillColorExpression)
			);
			errorMessage = `Map paint error for ${layerId}: ${error}`;
		}
	}

	// --- Main Update Function for Both Maps ---
	function updateCompareMaps() {
		if (!isMapReadyForData || !mapLeft || !mapRight) {
			return;
		}
		errorMessage = null; // Reset error on successful update start

		// console.log("ConstituencyCompareMap: Updating compare maps...");
		// Update feature states first (this also updates legend variables)
		const stateUpdatedLeft = updateFeatureStates(
			mapLeft,
			SOURCE_ID_LEFT,
			selectedParty,
			"",
			"party"
		);
		const stateUpdatedRight = updateFeatureStates(
			mapRight,
			SOURCE_ID_RIGHT,
			selectedMetric,
			"",
			"metric"
		);

		// Then update the paint properties using the new min/max values
		// Only update paint if state was successfully set
		if (stateUpdatedLeft) {
			updatePaintExpression(
				mapLeft,
				LAYER_ID_LEFT,
				"party",
				selectedParty
			);
		}
		if (stateUpdatedRight) {
			updatePaintExpression(
				mapRight,
				LAYER_ID_RIGHT,
				"metric",
				selectedMetric
			);
		}
		// console.log("ConstituencyCompareMap: Compare maps update complete.");
	}

	// --- Lifecycle: onMount ---
	onMount(async () => {
		console.log("ConstituencyCompareMap: onMount started.");
		if (!mapboxAccessToken) {
			errorMessage = "Mapbox Access Token missing.";
			isLoading = false;
			console.error(errorMessage);
			return;
		}
		mapboxgl.accessToken = mapboxAccessToken;

		try {
			console.log("ConstituencyCompareMap: Initializing maps...");
			mapLeft = new mapboxgl.Map({
				container: mapLeftContainer,
				...mapOptions,
			});
			mapRight = new mapboxgl.Map({
				container: mapRightContainer,
				...mapOptions,
			});

			await Promise.all([
				new Promise<void>((resolve) =>
					mapLeft!.once("load", () => resolve())
				),
				new Promise<void>((resolve) =>
					mapRight!.once("load", () => resolve())
				),
			]);
			console.log(
				"ConstituencyCompareMap: Both maps 'load' event fired."
			);
			if (!mapLeft || !mapRight)
				throw new Error("Maps not initialized after load.");

			// Use the simpler addSourceAndLayer function
			await Promise.all([
				addSourceAndLayer(mapLeft, SOURCE_ID_LEFT, LAYER_ID_LEFT),
				addSourceAndLayer(mapRight, SOURCE_ID_RIGHT, LAYER_ID_RIGHT),
			]);

			console.log(
				"ConstituencyCompareMap: Sources and layers added to both maps."
			);
			if (!mapLeft || !mapRight)
				throw new Error(
					"Maps not available after adding sources/layers."
				);

			console.log(
				"ConstituencyCompareMap: Dynamically importing MapboxCompare..."
			);
			const MapboxCompareModule = await import("mapbox-gl-compare");
			const MapboxCompareConstructor = MapboxCompareModule.default;
			console.log("ConstituencyCompareMap: MapboxCompare imported.");

			console.log(
				"ConstituencyCompareMap: Initializing MapboxCompare..."
			);
			if (mapLeft && mapRight) {
				compareControl = new MapboxCompareConstructor(
					mapLeft,
					mapRight,
					"#compare-container",
					{}
				);
				console.log(
					"ConstituencyCompareMap: MapboxCompare initialized."
				);
			} else {
				throw new Error(
					"Cannot initialize MapboxCompare: map instances are null."
				);
			}

			// Force paint update after initialization
			setTimeout(() => {
				if (mapLeft && mapRight) {
					console.log(
						"ConstituencyCompareMap: Forcing paint update after initialization"
					);
					mapLeft.setPaintProperty(
						LAYER_ID_LEFT,
						"fill-color",
						"#cccccc"
					);
					mapRight.setPaintProperty(
						LAYER_ID_RIGHT,
						"fill-color",
						"#cccccc"
					);
					setTimeout(updateCompareMaps, 100); // Trigger update after paint change
				}
			}, 300);

			isLoading = false;
			isMapReadyForData = true;
			console.log(
				"ConstituencyCompareMap: isMapReadyForData set to true."
			);

			console.log(
				"ConstituencyCompareMap: Triggering initial updateCompareMaps call."
			);
			updateCompareMaps(); // Trigger first update
		} catch (error: any) {
			console.error(
				"ConstituencyCompareMap: Error during map setup:",
				error
			);
			errorMessage = `Map setup failed: ${error.message || error}`;
			isLoading = false;
		}
	});

	// --- Lifecycle: onDestroy ---
	onDestroy(() => {
		console.log("ConstituencyCompareMap: onDestroy called.");
		isMapReadyForData = false;
		compareControl?.remove();
		mapLeft?.remove();
		mapRight?.remove();
		mapLeft = null;
		mapRight = null;
		compareControl = null;
	});

	// --- Reactive Update Logic (Using Svelte's $: block with checks) ---
	$: {
		if (
			isMapReadyForData &&
			(data?.length !== prevDataLength ||
				selectedParty !== prevSelectedParty ||
				selectedMetric !== prevSelectedMetric ||
				highlightedConstituency !== prevHighlight)
		) {
			// console.log("Compare Map: Reactive update triggered by change in data/selection/highlight");
			updateCompareMaps(); // This will recalculate colors and reset highlight state

			// Update previous values
			prevDataLength = data?.length ?? 0;
			prevSelectedParty = selectedParty;
			prevSelectedMetric = selectedMetric;
			prevHighlight = highlightedConstituency;
		}
	}

	// --- formatLegendLabel helper ---
	function formatLegendLabel(value: number | null): string {
		if (value === null) return "N/A";
		const numValue = Number(value);
		if (isNaN(numValue)) return "N/A";
		// Use labels specific to the map side being formatted if possible
		const checkLabel = leftLabel || rightLabel || ""; // Use whichever label is available, default to empty
		if (checkLabel.includes("(%)")) return `${numValue.toFixed(1)}%`;
		if (checkLabel.includes("(£)"))
			return numValue >= 1000
				? `£${(numValue / 1000).toFixed(0)}k`
				: `£${numValue.toLocaleString()}`;
		if (numValue < 10 && numValue !== 0) return numValue.toFixed(2);
		if (numValue >= 10000) return (numValue / 1000).toFixed(0) + "k";
		return numValue.toLocaleString(undefined, { maximumFractionDigits: 1 });
	}
</script>

<!-- HTML Template -->
<div
	class="relative font-sans border border-gray-200 rounded-lg shadow-sm mt-6 bg-gray-50"
>
	<!-- Error/Loading Overlays -->
	{#if errorMessage}
		<div
			class="absolute inset-0 flex items-center justify-center bg-red-100 text-red-700 p-4 z-30 rounded-lg text-sm"
		>
			{errorMessage}
		</div>
	{/if}
	{#if isLoading && !errorMessage}
		<div
			class="absolute inset-0 flex items-center justify-center bg-gray-100/80 text-gray-600 p-4 z-30 rounded-lg"
		>
			<!-- Loading -->
			<div class="flex flex-col items-center justify-center text-center">
				<div class="animate-pulse flex space-x-2 mb-2">
					<div class="h-2 w-2 bg-gray-400 rounded-full"></div>
					<div class="h-2 w-2 bg-gray-400 rounded-full"></div>
					<div class="h-2 w-2 bg-gray-400 rounded-full"></div>
				</div>
				<p class="text-sm">Loading comparison map...</p>
			</div>
		</div>
	{/if}

	<!-- Container for the Compare Control -->
	<div
		id="compare-container"
		class="relative w-full h-[450px] rounded-t-lg overflow-hidden {isLoading ||
		errorMessage
			? 'opacity-50 filter blur-sm'
			: ''}"
	>
		<div
			bind:this={mapLeftContainer}
			id={mapIdLeft}
			class="absolute top-0 bottom-0 w-full h-full"
		></div>
		<div
			bind:this={mapRightContainer}
			id={mapIdRight}
			class="absolute top-0 bottom-0 w-full h-full"
		></div>
	</div>

	<!-- Combined Legend -->
	{#if !isLoading && !errorMessage}
		<div
			class="bg-white/80 backdrop-blur-sm p-2 rounded-b-lg border-t border-gray-200 grid grid-cols-2 gap-4"
		>
			<!-- Left Legend (Party) -->
			<div class="text-center">
				<div
					class="text-xs text-gray-700 mb-1 font-medium truncate"
					title={leftLabel || "Party Voteshare"}
				>
					Left: {leftLabel || "Party Voteshare"}
				</div>
				{#if leftMinValue !== null && leftMaxValue !== null && leftMaxValue >= leftMinValue}
					<!-- Show quintile legend instead of gradient -->
					{@const basePartyColor =
						partyColors[selectedParty] || "#888888"}
					<div class="flex items-center justify-center space-x-1">
						<span class="text-xs text-gray-600"
							>{formatLegendLabel(leftMinValue)}</span
						>
						<div
							class="flex h-3 flex-grow max-w-[100px] rounded overflow-hidden"
						>
							<div
								class="w-1/5"
								style:background-color={lightenColor(
									basePartyColor,
									0.8
								)}
							></div>
							<div
								class="w-1/5"
								style:background-color={lightenColor(
									basePartyColor,
									0.6
								)}
							></div>
							<div
								class="w-1/5"
								style:background-color={lightenColor(
									basePartyColor,
									0.4
								)}
							></div>
							<div
								class="w-1/5"
								style:background-color={lightenColor(
									basePartyColor,
									0.2
								)}
							></div>
							<div
								class="w-1/5"
								style:background-color={basePartyColor}
							></div>
						</div>
						<span class="text-xs text-gray-600"
							>{formatLegendLabel(leftMaxValue)}</span
						>
					</div>
				{:else}
					<div class="text-xs text-gray-500 italic">
						(No data range)
					</div>
				{/if}
			</div>

			<!-- Right Legend (Metric) -->
			<div class="text-center">
				<div
					class="text-xs text-gray-700 mb-1 font-medium truncate"
					title={rightLabel || "Metric"}
				>
					Right: {rightLabel || "Metric"}
				</div>
				{#if rightMinValue !== null && rightMaxValue !== null && rightMaxValue >= rightMinValue}
					<!-- Show quintile legend -->
					<div class="flex items-center justify-center space-x-1">
						<span class="text-xs text-gray-600"
							>{formatLegendLabel(rightMinValue)}</span
						>
						<div
							class="flex h-3 flex-grow max-w-[100px] rounded overflow-hidden"
						>
							<div
								class="w-1/5"
								style="background-color: #ffffd9;"
							></div>
							<div
								class="w-1/5"
								style="background-color: #edf8b1;"
							></div>
							<div
								class="w-1/5"
								style="background-color: #b2e2e2;"
							></div>
							<div
								class="w-1/5"
								style="background-color: #66c2a4;"
							></div>
							<div
								class="w-1/5"
								style="background-color: #2c7fb8;"
							></div>
						</div>
						<span class="text-xs text-gray-600"
							>{formatLegendLabel(rightMaxValue)}</span
						>
					</div>
				{:else}
					<div class="text-xs text-gray-500 italic">
						(No data range)
					</div>
				{/if}
			</div>

			<div class="col-span-2 text-center text-[10px] text-gray-500 mt-1">
				Constituencies with 0 or no data shown in grey. Highlighted
				constituencies outlined in black.
			</div>
		</div>
	{/if}
</div>

<!-- Global Styles -->
<style>
	/* Container required by mapbox-gl-compare */
	#compare-container {
		position: relative;
		overflow: hidden;
	}
	/* Map containers must be absolute */
	#compare-container > div[id^="compare-map-"] {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 100%;
		height: 100%;
	}
	/* Optional: Style the compare slider */
	:global(#compare-container .mapboxgl-compare__swiper) {
		/* ... */
	}
	:global(#compare-container .mapboxgl-compare__handle) {
		/* ... */
	}
	.relative {
		position: relative;
	}
</style>
