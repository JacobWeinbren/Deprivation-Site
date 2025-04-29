<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { browser } from "$app/environment";
	import type {
		Map as MaplibreMap,
		MapOptions,
		LngLatLike,
		LngLatBoundsLike,
		ErrorEvent,
		MapDataEvent,
		MapMouseEvent,
		Popup,
		GeoJSONGeometry,
		NavigationControl,
	} from "maplibre-gl";

	// Import Config and Base Utils
	import type {
		ConstituencyData,
		MetricOption,
		PartyOption,
	} from "$lib/components/scatter/types";
	import { getNumericValue } from "$lib/components/scatter/utils";
	import { formatLegendLabel } from "$lib/components/scatter/ChartUtils";

	// Import Map Specific Utils, Constants, Setup
	import { calculateBounds, zoomToBounds } from "./mapUtils";
	import {
		addInitialSourceAndLayers,
		updateMapPaintProperties,
	} from "./mapLayerUtils"; // Use non-animated version
	import { initializeMapInstance } from "./mapSetup";
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
	} from "./MapConstants";

	// Import sub-components
	import MapTooltip from "./MapTooltip.svelte";
	import MapLegend from "./MapLegend.svelte";
	import MapErrorOverlay from "./MapErrorOverlay.svelte";

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
	// partyColors prop is not used for map styling
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
	let navControlLeft: NavigationControl | null = null;
	let navControlRight: NavigationControl | null = null;
	let isLoading: boolean = true;
	let errorMessage: string | null = null;
	let mapsInitialized = false;
	let sourcesAndLayersAdded = false;
	let isMapReadyForData = false;
	let compareControlInitialized = false;

	// --- Dynamically Imported Modules ---
	let maplibregl: typeof import("maplibre-gl") | null = null;
	let MaplibreCompare: any = null;
	let MaplibrePopup: typeof Popup | null = null;
	let MaplibreNavigationControl: typeof NavigationControl | null = null;

	// --- Component State ---
	let leftLabel: string = "";
	let leftMinValue: number | null = null;
	let leftMaxValue: number | null = null;
	let rightLabel: string = "";
	let rightMinValue: number | null = null;
	let rightMaxValue: number | null = null;
	let hoveredLeftId: string | number | null = null;
	let hoveredRightId: string | number | null = null;
	let customPopupVisible = false;
	let customPopupContent = "";
	let customPopupPosition = { x: 0, y: 0 };
	let containerRect: DOMRect | null = null;
	let compareContainerElement: HTMLElement;

	// --- Tracking previous values ---
	let prevSelectedParty = selectedParty;
	let prevSelectedMetric = selectedMetric;
	let prevHighlight = highlightedConstituency;
	let prevDataLength = data?.length ?? 0;

	// --- Map Interaction Handlers ---
	function handleConstituencyClick(e: MapMouseEvent) {
		if (e.features && e.features.length > 0) {
			const feature = e.features[0];
			const name = feature.properties?.[FEATURE_NAME_PROPERTY];
			if (name) dispatch("constituencyClick", { name });
			const bounds = calculateBounds(feature.geometry);
			zoomToBounds(mapLeft, mapRight, bounds);
		}
	}
	export function zoomToConstituency(name: string) {
		if (!mapLeft || !mapRight || !data || data.length === 0) return;
		const constituency = data.find((d) => d.constituency_name === name);
		if (!constituency?.const_code) return;
		const features = mapLeft.querySourceFeatures(SOURCE_ID_LEFT, {
			sourceLayer: SOURCE_LAYER,
			filter: ["==", FEATURE_ID_PROPERTY, constituency.const_code],
		});
		if (features?.length > 0) {
			const bounds = calculateBounds(features[0].geometry);
			zoomToBounds(mapLeft, mapRight, bounds);
		}
	}
	function handleMouseMove(
		map: MaplibreMap,
		e: MapMouseEvent,
		isLeftMap: boolean
	) {
		if (!e.features || e.features.length === 0) {
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
		if (
			(isLeftMap && featureId === hoveredLeftId) ||
			(!isLeftMap && featureId === hoveredRightId)
		) {
			if (!containerRect)
				containerRect = compareContainerElement.getBoundingClientRect();
			customPopupPosition = { x: e.point.x, y: e.point.y };
			return;
		}
		if (isLeftMap) hoveredLeftId = featureId;
		else hoveredRightId = featureId;
		const name = feature.properties?.[FEATURE_NAME_PROPERTY];
		const code = feature.properties?.[FEATURE_ID_PROPERTY];
		const constituencyData = data.find((d) => d.const_code === code);
		const selectedKey = isLeftMap ? selectedParty : selectedMetric;
		const label = isLeftMap ? leftLabel : rightLabel;
		const value = constituencyData
			? getNumericValue(constituencyData, selectedKey)
			: null;
		const formattedValue = formatLegendLabel(value, label);
		customPopupContent = `<div class="custom-map-tooltip"><strong>${name || "Unknown"}</strong><span class="block text-[11px]">${label.split("(")[0].trim()}: ${formattedValue}</span></div>`;
		if (!containerRect)
			containerRect = compareContainerElement.getBoundingClientRect();
		customPopupPosition = { x: e.point.x, y: e.point.y };
		customPopupVisible = true;
	}
	function handleMouseLeave(map: MaplibreMap, isLeftMap: boolean) {
		map.getCanvas().style.cursor = "";
		if (isLeftMap) {
			if (hoveredLeftId !== null) {
				hoveredLeftId = null;
				customPopupVisible = false;
			}
		} else {
			if (hoveredRightId !== null) {
				hoveredRightId = null;
				customPopupVisible = false;
			}
		}
		if (hoveredLeftId === null && hoveredRightId === null)
			customPopupVisible = false;
	}

	// --- Feature State & Style Update Logic ---
	function updateFeatureStates(
		mapInstance: MaplibreMap | null,
		sourceId: string,
		variableKey: string,
		variableType: "party" | "metric"
	): boolean {
		if (
			!mapInstance ||
			!mapInstance.isStyleLoaded() ||
			!mapInstance.getSource(sourceId)
		)
			return false;
		if (!data || data.length === 0 || !variableKey) return false;
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
			if (value !== null && isFinite(value) && value >= 0)
				validValues.push(value);
		});
		const currentMinValue =
			validValues.length > 0 ? Math.min(...validValues) : null;
		const currentMaxValue =
			validValues.length > 0 ? Math.max(...validValues) : null;
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
		let featuresUpdated = 0;
		Object.entries(featureData).forEach(([code, { name }]) => {
			const isHighlighted = name === highlightedConstituency;
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
						{ highlighted: isHighlighted }
					);
					featuresUpdated++;
				}
			} catch (e) {
				/* Silently handle */
			}
		});
		return featuresUpdated > 0;
	}

	// --- Main Update Function (No Animation) ---
	function updateCompareMaps(forceUpdate = false) {
		if (!mapsInitialized || !sourcesAndLayersAdded || !isMapReadyForData)
			return;
		if (!mapLeft || !mapRight) return;
		errorMessage = null;
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
		if (stateUpdatedLeft || forceUpdate) {
			updateMapPaintProperties(
				mapLeft,
				LAYER_ID_LEFT,
				`${LAYER_ID_LEFT}-highlight-outline`,
				SOURCE_ID_LEFT,
				"party",
				selectedParty,
				data,
				highlightedConstituency
			);
		}
		if (stateUpdatedRight || forceUpdate) {
			updateMapPaintProperties(
				mapRight,
				LAYER_ID_RIGHT,
				`${LAYER_ID_RIGHT}-highlight-outline`,
				SOURCE_ID_RIGHT,
				"metric",
				selectedMetric,
				data,
				highlightedConstituency
			);
		}
	}

	// --- Lifecycle ---
	onMount(async () => {
		if (!browser) return;
		isLoading = true;
		mapsInitialized = false;
		sourcesAndLayersAdded = false;
		isMapReadyForData = false;
		compareControlInitialized = false;
		errorMessage = null;
		try {
			const maplibreModule = await import("maplibre-gl");
			maplibregl = maplibreModule.default;
			MaplibrePopup = maplibreModule.Popup;
			MaplibreNavigationControl = maplibreModule.NavigationControl;
			MaplibreCompare = (await import("@maplibre/maplibre-gl-compare"))
				.default;
			if (!maplibregl || !MaplibreCompare || !MaplibreNavigationControl)
				throw new Error("Failed to load MapLibre libraries");
			const mapLeftInstance = initializeMapInstance(
				maplibregl,
				MaplibreNavigationControl,
				mapLeftContainer,
				(e) => {
					errorMessage = `Left map error: ${e.error?.message || "Unknown error"}`;
				}
			);
			const mapRightInstance = initializeMapInstance(
				maplibregl,
				MaplibreNavigationControl,
				mapRightContainer,
				(e) => {
					errorMessage = `Right map error: ${e.error?.message || "Unknown error"}`;
				}
			);
			if (!mapLeftInstance || !mapRightInstance)
				throw new Error("Map instance initialization failed.");
			mapLeft = mapLeftInstance.map;
			navControlLeft = mapLeftInstance.navControl;
			mapRight = mapRightInstance.map;
			navControlRight = mapRightInstance.navControl;
			mapLeft.on("click", LAYER_ID_LEFT, handleConstituencyClick);
			mapRight.on("click", LAYER_ID_RIGHT, handleConstituencyClick);
			mapLeft.on("mousemove", LAYER_ID_LEFT, (e) =>
				handleMouseMove(mapLeft!, e, true)
			);
			mapRight.on("mousemove", LAYER_ID_RIGHT, (e) =>
				handleMouseMove(mapRight!, e, false)
			);
			mapLeft.on("mouseleave", LAYER_ID_LEFT, () =>
				handleMouseLeave(mapLeft!, true)
			);
			mapRight.on("mouseleave", LAYER_ID_RIGHT, () =>
				handleMouseLeave(mapRight!, false)
			);
			await Promise.all([
				new Promise<void>((resolve) => mapLeft!.once("load", resolve)),
				new Promise<void>((resolve) => mapRight!.once("load", resolve)),
			]);
			mapsInitialized = true;
			await Promise.all([
				addInitialSourceAndLayers(
					mapLeft,
					SOURCE_ID_LEFT,
					LAYER_ID_LEFT,
					`${LAYER_ID_LEFT}-highlight-outline`
				),
				addInitialSourceAndLayers(
					mapRight,
					SOURCE_ID_RIGHT,
					LAYER_ID_RIGHT,
					`${LAYER_ID_RIGHT}-highlight-outline`
				),
			]);
			sourcesAndLayersAdded = true;
			await Promise.all([
				new Promise<void>((resolve) => mapLeft!.once("idle", resolve)),
				new Promise<void>((resolve) => mapRight!.once("idle", resolve)),
			]);
			if (mapLeft && mapRight && compareContainerElement) {
				try {
					compareControl = new MaplibreCompare(
						mapLeft,
						mapRight,
						compareContainerElement
					);
					if (!compareControlInitialized) {
						requestAnimationFrame(() => {
							setTimeout(() => {
								if (compareControl) {
									window.dispatchEvent(new Event("resize"));
									compareControlInitialized = true;
								}
							}, 100);
						});
					}
				} catch (compareError) {
					throw new Error(
						"Map compare control failed to initialize."
					);
				}
			} else {
				throw new Error(
					"Maps or container unavailable before compare init"
				);
			}
			mapLeftContainer.style.opacity = "1";
			mapRightContainer.style.opacity = "1";
			isMapReadyForData = true;
			updateCompareMaps(true);
			isLoading = false;
			console.log("Map initialization complete");
		} catch (error: any) {
			console.error("Error during map setup:", error);
			errorMessage = `Map setup failed: ${error.message || error}`;
			isLoading = false;
			isMapReadyForData = false;
		}
	});

	onDestroy(() => {
		console.log("Map onDestroy: Cleaning up...");
		if (navControlLeft && mapLeft?.hasControl(navControlLeft))
			mapLeft.removeControl(navControlLeft);
		if (navControlRight && mapRight?.hasControl(navControlRight))
			mapRight.removeControl(navControlRight);
		compareControl?.remove();
		mapLeft?.remove();
		mapRight?.remove();
		mapLeft = null;
		mapRight = null;
		compareControl = null;
		navControlLeft = null;
		navControlRight = null;
		maplibregl = null;
		MaplibreCompare = null;
		MaplibrePopup = null;
		MaplibreNavigationControl = null;
		console.log("Map cleanup complete");
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

	// --- Global Event Listeners ---
	function handleRetry() {
		if (mapLeft && mapRight) {
			errorMessage = null;
			isLoading = true;
			setTimeout(() => {
				updateCompareMaps(true);
				isLoading = false;
			}, 50);
		}
	}
	$: if (browser) {
		window.addEventListener("retry", handleRetry);
		() => window.removeEventListener("retry", handleRetry);
	}
</script>

<!-- HTML Template -->
<div
	class="relative font-sans border border-gray-200/75 rounded-lg bg-white overflow-hidden shadow-sm"
>
	<MapErrorOverlay {errorMessage} {isLoading} />
	<div
		bind:this={compareContainerElement}
		id="compare-container"
		class="relative w-full h-[450px] sm:h-[500px] md:h-[550px] rounded-t-lg overflow-hidden bg-gray-100 {isLoading ||
		errorMessage
			? 'opacity-50 blur-[2px] pointer-events-none'
			: ''} transition-all duration-200"
	>
		<div
			bind:this={mapLeftContainer}
			id={mapIdLeft}
			class="map-instance"
		></div>
		<div
			bind:this={mapRightContainer}
			id={mapIdRight}
			class="map-instance"
		></div>
		<MapTooltip
			visible={customPopupVisible}
			content={customPopupContent}
			position={customPopupPosition}
		/>
	</div>
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
