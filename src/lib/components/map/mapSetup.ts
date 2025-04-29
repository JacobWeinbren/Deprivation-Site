import type {
	Map as MaplibreMap,
	MapOptions,
	LngLatLike,
	LngLatBoundsLike,
	ErrorEvent,
	NavigationControl,
} from "maplibre-gl";
import {
	UK_DEFAULT_CENTER,
	UK_DEFAULT_ZOOM,
	minimalStyle,
} from "./MapConstants";

// Define types for the libraries if they are passed dynamically
type MapLibreGL = typeof import("maplibre-gl");
type NavigationControlClass = typeof NavigationControl;

/**
 * Initializes a single MapLibre map instance with basic controls and error handling.
 */
export function initializeMapInstance(
	maplibre: MapLibreGL,
	NavControl: NavigationControlClass,
	container: HTMLElement,
	onError: (error: ErrorEvent) => void
): { map: MaplibreMap; navControl: NavigationControl } | null {
	try {
		const mapOptions: Omit<MapOptions, "container"> = {
			style: minimalStyle,
			center: UK_DEFAULT_CENTER as LngLatLike,
			zoom: UK_DEFAULT_ZOOM,
			minZoom: 4,
			maxZoom: 14,
			pitch: 0,
			bearing: 0,
			pitchWithRotate: false,
			dragRotate: false,
			touchZoomRotate: false,
			attributionControl: false,
			maxBounds: [
				[-25, 49], // Southwest
				[20, 61], // Northeast
			] as LngLatBoundsLike,
		};

		const map = new maplibre.Map({
			container: container,
			...mapOptions,
		});

		map.on("error", onError);

		const navControl = new NavControl({
			showCompass: false,
			showZoom: true,
		});
		map.addControl(navControl, "top-right");

		return { map, navControl };
	} catch (error) {
		console.error("Failed to initialize map instance:", error);
		// Call the onError callback manually if creation fails
		onError({
			type: "error",
			error:
				error instanceof Error
					? error
					: new Error("Map creation failed"),
		} as ErrorEvent);
		return null;
	}
}
