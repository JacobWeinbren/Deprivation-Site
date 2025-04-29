<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from "svelte";
	import { browser } from "$app/environment";
	import type {
		MaplibreMap,
		MapMouseEvent,
		MapErrorEvent,
		ConstituencyData,
		MetricOption,
		PartyOption,
		NavigationControl,
	} from "$lib/types";

	// Import Config and Base Utils
	import { getNumericValue, formatDisplayValue } from "$lib/utils";
	import {
		metricQuintileColors,
		partyQuintileColors,
		FEATURE_NAME_PROPERTY,
		FEATURE_ID_PROPERTY,
		SOURCE_LAYER, // Import SOURCE_LAYER
	} from "$lib/config";

	// Import Map Specific Utils, Constants, Setup
	import {
		addOrUpdateSourceAndLayers,
		updateMapPaint,
	} from "./mapLayerUtils";
	import { initializeMapInstance } from "./mapSetup";

	// Import sub-components
	import MapTooltip from "./MapTooltip.svelte";
	import MapLegend from "./MapLegend.svelte";
	import MapErrorOverlay from "./MapErrorOverlay.svelte";

	// --- Props ---
	export let data: ConstituencyData[] = [];
	export let selectedParty: string = "";
	export let selectedMetric: string = "";
	export let highlightedConstituency: string | null = null;
	export let metrics: MetricOption[] = [];
	export let parties: PartyOption[] = [];
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
	let isLoading: boolean = true; // Start true
	let errorMessage: string | null = null;
	let isReady: boolean = false;
	let compareControlInitialized = false;
	let compareContainerElement: HTMLElement;

	// --- Dynamically Imported Modules ---
	let maplibregl: typeof import("maplibre-gl") | null = null;
	let MaplibreCompare: any = null;
	let MaplibreNavigationControl: typeof NavigationControl | null = null;

	// --- Component State ---
	let leftLabel: string = "";
	let leftMinValue: number | null = null;
	let leftMaxValue: number | null = null;
	let rightLabel: string = "";
	let rightMinValue: number | null = null;
	let rightMaxValue: number | null = null;
	let hoveredFeatureId: string | number | null = null;
	let customPopupVisible = false;
	let customPopupContent = "";
	let customPopupPosition = { x: 0, y: 0 };
	let containerRect: DOMRect | null = null;

	// --- Tracking previous values ---
	let prevSelectedParty = selectedParty;
	let prevSelectedMetric = selectedMetric;
	let prevHighlight = highlightedConstituency;
	let prevDataLength = data?.length ?? 0;

	const dispatch = createEventDispatcher<{
		constituencyClick: { name: string };
	}>();
	const logPrefix = "[CompareMap]"; // Logging prefix

	// --- Map Interaction Handlers ---
	function handleConstituencyClick(e: MapMouseEvent) {
		if (e.features && e.features.length > 0) {
			const feature = e.features[0];
			const name = feature.properties?.[FEATURE_NAME_PROPERTY];
			if (name) {
				console.log(
					`${logPrefix} Clicked on ${name}, dispatching event.`
				);
				dispatch("constituencyClick", { name });
			} else {
				console.warn(
					`${logPrefix} Clicked feature missing name property.`
				);
			}
		}
	}

	function handleMouseMove(map: MaplibreMap, e: MapMouseEvent) {
		if (!e.features || e.features.length === 0) {
			if (hoveredFeatureId !== null) {
				handleMouseLeave(map);
			}
			return;
		}

		map.getCanvas().style.cursor = "pointer";
		const feature = e.features[0];
		const featureId = feature.id;

		if (!containerRect)
			containerRect = compareContainerElement.getBoundingClientRect();
		customPopupPosition = { x: e.point.x, y: e.point.y };

		if (featureId === hoveredFeatureId) {
			return; // Already showing tooltip
		}

		hoveredFeatureId = featureId;

		const name = feature.properties?.[FEATURE_NAME_PROPERTY];
		const code = feature.properties?.[FEATURE_ID_PROPERTY];
		const constituencyData = data.find((d) => d.const_code === code);

		// Determine which map side the layer belongs to
		const layerId = feature.layer.id;
		const isLeftLayer = layerId.includes("-left"); // Simple check based on convention
		const selectedKey = isLeftLayer ? selectedParty : selectedMetric;
		const label = isLeftLayer ? leftLabel : rightLabel;
		const value = constituencyData
			? getNumericValue(constituencyData, selectedKey)
			: null;
		const formattedValue = formatDisplayValue(value, label);

		customPopupContent = `<div class="map-tooltip-content"><strong>${name || "Unknown"}</strong><span class="block text-xs">${label.split("(")[0].trim()}: ${formattedValue}</span></div>`;
		customPopupVisible = true;
	}

	function handleMouseLeave(map: MaplibreMap) {
		if (hoveredFeatureId !== null) {
			map.getCanvas().style.cursor = "";
			hoveredFeatureId = null;
			customPopupVisible = false;
		}
	}

	// --- Update Map Styles ---
	function updateMapStyles(forceUpdate = false) {
		if (!isReady || !mapLeft || !mapRight) {
			// console.warn(`${logPrefix} updateMapStyles called but maps not ready.`);
			return;
		}
		// console.log(`${logPrefix} Updating map styles. Force: ${forceUpdate}`);
		errorMessage = null;

		// Update labels and min/max values for the legend
		const partyInfo = parties.find((p) => p.value === selectedParty);
		leftLabel = partyInfo?.label || selectedParty;
		const metricInfo = metrics.find((m) => m.value === selectedMetric);
		rightLabel = metricInfo?.label || selectedMetric;

		const partyValues = data
			.map((d) => getNumericValue(d, selectedParty))
			.filter((v): v is number => v !== null && isFinite(v) && v >= 0);
		const metricValues = data
			.map((d) => getNumericValue(d, selectedMetric))
			.filter((v): v is number => v !== null && isFinite(v) && v >= 0);

		leftMinValue = partyValues.length > 0 ? Math.min(...partyValues) : null;
		leftMaxValue = partyValues.length > 0 ? Math.max(...partyValues) : null;
		rightMinValue =
			metricValues.length > 0 ? Math.min(...metricValues) : null;
		rightMaxValue =
			metricValues.length > 0 ? Math.max(...metricValues) : null;

		// Update paint properties
		updateMapPaint(
			mapLeft,
			"constituency-fills-left",
			"constituency-highlight-left",
			"party",
			selectedParty,
			data,
			highlightedConstituency
		);
		updateMapPaint(
			mapRight,
			"constituency-fills-right",
			"constituency-highlight-right",
			"metric",
			selectedMetric,
			data,
			highlightedConstituency
		);
		// console.log(`${logPrefix} Map styles update complete.`);
	}

	// --- Lifecycle ---
	onMount(async () => {
		console.log(`${logPrefix} Component mounted.`);
		if (!browser) return;
		isLoading = true; // Start loading
		isReady = false;
		compareControlInitialized = false;
		errorMessage = null;

		try {
			console.log(`${logPrefix} Loading libraries...`);
			const maplibreModule = await import("maplibre-gl");
			maplibregl = maplibreModule.default;
			MaplibreNavigationControl = maplibreModule.NavigationControl;
			MaplibreCompare = (await import("@maplibre/maplibre-gl-compare"))
				.default;

			if (!maplibregl || !MaplibreCompare || !MaplibreNavigationControl) {
				throw new Error("Failed to load MapLibre libraries");
			}
			console.log(`${logPrefix} Libraries loaded.`);

			const handleError = (side: string) => (e: MapErrorEvent) => {
				// Avoid setting error if it's just a tile load error (can be transient)
				if (e.error?.message?.includes("Failed to load tile")) {
					console.warn(
						`${logPrefix} Tile load error (${side}):`,
						e.error.message
					);
					return;
				}
				console.error(
					`${logPrefix} Unrecoverable map error (${side}):`,
					e.error
				);
				errorMessage = `${side} map error: ${e.error?.message || "Unknown error"}`;
				isLoading = false;
				isReady = false; // Mark as not ready on critical error
			};

			console.log(`${logPrefix} Initializing map instances...`);
			const [mapLeftResult, mapRightResult] = await Promise.all([
				initializeMapInstance(
					maplibregl,
					MaplibreNavigationControl,
					mapLeftContainer,
					handleError("Left")
				),
				initializeMapInstance(
					maplibregl,
					MaplibreNavigationControl,
					mapRightContainer,
					handleError("Right")
				),
			]).catch((initError) => {
				// Catch errors from initializeMapInstance promise rejection
				console.error(
					`${logPrefix} Map initialization failed:`,
					initError
				);
				throw initError instanceof Error
					? initError
					: new Error("Map initialization failed.");
			});
			console.log(
				`${logPrefix} Map instances initialized (pending load event).`
			);

			// Destructure results after promise resolution
			mapLeft = mapLeftResult.map;
			navControlLeft = mapLeftResult.navControl;
			mapRight = mapRightResult.map;
			navControlRight = mapRightResult.navControl;

			// Note: initializeMapInstance now resolves *after* 'load' event

			console.log(`${logPrefix} Adding sources and layers...`);
			await Promise.all([
				addOrUpdateSourceAndLayers(
					mapLeft,
					"constituencies-source", // Shared source ID
					"constituency-fills-left",
					"constituency-highlight-left"
				),
				addOrUpdateSourceAndLayers(
					mapRight,
					"constituencies-source", // Shared source ID
					"constituency-fills-right",
					"constituency-highlight-right"
				),
			]);
			console.log(`${logPrefix} Sources and layers added.`);

			// Wait for maps to be idle after adding layers (extra safety)
			console.log(`${logPrefix} Waiting for maps to idle...`);
			await Promise.all([
				new Promise<void>((resolve) => mapLeft!.once("idle", resolve)),
				new Promise<void>((resolve) => mapRight!.once("idle", resolve)),
			]);
			console.log(`${logPrefix} Maps are idle.`);

			// Setup Compare Control
			if (mapLeft && mapRight && compareContainerElement) {
				console.log(`${logPrefix} Initializing compare control...`);
				try {
					compareControl = new MaplibreCompare(
						mapLeft,
						mapRight,
						compareContainerElement
					);
					requestAnimationFrame(() => {
						setTimeout(() => {
							console.log(
								`${logPrefix} Triggering resize for compare control.`
							);
							window.dispatchEvent(new Event("resize"));
							compareControlInitialized = true;
						}, 150);
					});
				} catch (compareError) {
					console.error(
						`${logPrefix} Map compare control init error:`,
						compareError
					);
					throw new Error(
						"Map compare control failed to initialize."
					);
				}
			} else {
				throw new Error(
					"Maps or container unavailable for compare init"
				);
			}

			// Setup event listeners
			console.log(`${logPrefix} Adding event listeners...`);
			mapLeft.on(
				"click",
				"constituency-fills-left",
				handleConstituencyClick
			);
			mapRight.on(
				"click",
				"constituency-fills-right",
				handleConstituencyClick
			);
			mapLeft.on("mousemove", "constituency-fills-left", (e) =>
				handleMouseMove(mapLeft!, e)
			);
			mapRight.on("mousemove", "constituency-fills-right", (e) =>
				handleMouseMove(mapRight!, e)
			);
			mapLeft.on("mouseleave", "constituency-fills-left", () =>
				handleMouseLeave(mapLeft!)
			);
			mapRight.on("mouseleave", "constituency-fills-right", () =>
				handleMouseLeave(mapRight!)
			);

			// Maps are ready
			console.log(
				`${logPrefix} Maps are ready. Performing initial style update.`
			);
			isReady = true;
			updateMapStyles(true); // Initial style update
			isLoading = false; // Set loading false *after* everything is ready
			console.log(`${logPrefix} Map initialization complete.`);
		} catch (error: any) {
			console.error(`${logPrefix} Error during map setup:`, error);
			errorMessage = `Map setup failed: ${error.message || error}`;
			isLoading = false; // Ensure loading stops on error
			isReady = false;
		}
	});

	onDestroy(() => {
		console.log(`${logPrefix} Component destroying...`);
		// Remove event listeners first
		try {
			mapLeft?.off(
				"click",
				"constituency-fills-left",
				handleConstituencyClick
			);
			mapRight?.off(
				"click",
				"constituency-fills-right",
				handleConstituencyClick
			);
			mapLeft?.off(
				"mousemove",
				"constituency-fills-left",
				handleMouseMove
			);
			mapRight?.off(
				"mousemove",
				"constituency-fills-right",
				handleMouseMove
			);
			mapLeft?.off(
				"mouseleave",
				"constituency-fills-left",
				handleMouseLeave
			);
			mapRight?.off(
				"mouseleave",
				"constituency-fills-right",
				handleMouseLeave
			);
		} catch (e) {
			console.warn(`${logPrefix} Error removing listeners:`, e);
		}

		// Remove controls and maps
		try {
			compareControl?.remove();
			if (navControlLeft && mapLeft?.hasControl(navControlLeft))
				mapLeft.removeControl(navControlLeft);
			if (navControlRight && mapRight?.hasControl(navControlRight))
				mapRight.removeControl(navControlRight);
			mapLeft?.remove();
			mapRight?.remove();
		} catch (e) {
			console.warn(`${logPrefix} Error removing map resources:`, e);
		}

		// Clear state
		mapLeft = null;
		mapRight = null;
		compareControl = null;
		navControlLeft = null;
		navControlRight = null;
		maplibregl = null;
		MaplibreCompare = null;
		MaplibreNavigationControl = null;
		isReady = false;
		console.log(`${logPrefix} Map cleanup complete.`);
	});

	// --- Reactive Update Logic ---
	$: {
		if (
			browser &&
			isReady && // Only update if maps are fully ready
			(data?.length !== prevDataLength ||
				selectedParty !== prevSelectedParty ||
				selectedMetric !== prevSelectedMetric ||
				highlightedConstituency !== prevHighlight)
		) {
			// console.log(`${logPrefix} Reactive change detected, updating map styles.`);
			updateMapStyles();
			prevDataLength = data?.length ?? 0;
			prevSelectedParty = selectedParty;
			prevSelectedMetric = selectedMetric;
			prevHighlight = highlightedConstituency;
		}
	}

	// --- Global Event Listener for Retry ---
	function handleRetry() {
		if (!isLoading && errorMessage) {
			console.log(`${logPrefix} Retrying map operation...`);
			errorMessage = null;
			isLoading = true;
			// Attempt to re-run the setup logic by forcing a re-mount?
			// Or simply try updating styles if isReady was somehow true?
			// For simplicity, let's assume a full re-init might be needed.
			// A simple way is to reload the page, but less ideal UX.
			// A more complex way involves resetting state and re-triggering onMount logic.
			// Let's just try updating styles if possible, otherwise indicate failure.
			setTimeout(() => {
				if (isReady && mapLeft && mapRight) {
					console.log(
						`${logPrefix} Retry: Maps seem ready, forcing style update.`
					);
					updateMapStyles(true);
					isLoading = false;
				} else {
					console.error(
						`${logPrefix} Retry failed: Maps not initialized.`
					);
					isLoading = false;
					errorMessage =
						"Retry failed: Maps could not be initialized.";
				}
			}, 50);
		}
	}
	onMount(() => {
		if (browser) window.addEventListener("retry", handleRetry);
	});
	onDestroy(() => {
		if (browser) window.removeEventListener("retry", handleRetry);
	});
</script>

<!-- Template remains the same -->
<div
	class="relative overflow-hidden rounded-lg border border-gray-200/80 bg-white font-sans shadow-sm"
>
	<MapErrorOverlay {errorMessage} {isLoading} on:retry={handleRetry} />

	<div
		bind:this={compareContainerElement}
		id="compare-container"
		class="relative h-[450px] w-full overflow-hidden rounded-t-lg bg-gray-100 sm:h-[500px] md:h-[550px] {isLoading ||
		errorMessage
			? 'opacity-50 blur-[1px] pointer-events-none'
			: ''} transition-opacity duration-200"
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

<!-- Style remains the same -->
<style>
	#compare-container > div.map-instance {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 100%;
		height: 100%;
	}
	:global(.map-tooltip-content strong) {
		display: block;
		font-weight: 600;
		margin-bottom: 1px;
		font-size: 13px;
		color: #fff;
	}
	:global(.map-tooltip-content span) {
		display: block;
		color: #e5e7eb;
		font-size: 11px;
	}
</style>
