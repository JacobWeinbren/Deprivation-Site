import type {
	MaplibreMap,
	MapOptions,
	LngLatLike,
	LngLatBoundsLike,
	MapErrorEvent,
	NavigationControl,
} from "$lib/types";
import { UK_DEFAULT_CENTER, UK_DEFAULT_ZOOM } from "$lib/config";

type MapLibreGL = typeof import("maplibre-gl");
type NavigationControlClass = typeof NavigationControl;

const minimalStyle = { version: 8, sources: {}, layers: [] };
const logPrefix = "[MapSetup]"; // Logging prefix

/**
 * Initializes a single MapLibre map instance with basic controls and error handling.
 */
export function initializeMapInstance(
	maplibre: MapLibreGL,
	NavControl: NavigationControlClass,
	container: HTMLElement,
	onError: (error: MapErrorEvent) => void // Parent error handler
): Promise<{ map: MaplibreMap; navControl: NavigationControl }> {
	console.log(`${logPrefix} Initializing map in container:`, container.id);
	return new Promise((resolve, reject) => {
		let map: MaplibreMap | null = null; // Declare map variable here

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

			map = new maplibre.Map({
				container: container,
				...mapOptions,
			});

			// Centralized error handler for this instance
			const handleMapError = (e: MapErrorEvent) => {
				console.error(
					`${logPrefix} Map error on ${container.id}:`,
					e.error
				);
				onError(e); // Call parent handler
				reject(e.error || new Error(`Map error on ${container.id}`)); // Reject the promise
			};

			map.on("error", handleMapError);

			// Add navigation control
			const navControl = new NavControl({
				showCompass: false,
				showZoom: true,
			});
			map.addControl(navControl, "top-right");

			// Resolve the promise once the map style has loaded
			map.once("load", () => {
				console.log(
					`${logPrefix} Map style loaded for ${container.id}.`
				);
				// Remove the specific load error handler if load succeeds
				map?.off("error", handleMapError); // Keep general error handler
				resolve({ map: map!, navControl }); // map is guaranteed non-null here
			});

			// Add a timeout for the load event
			const loadTimeout = setTimeout(() => {
				console.error(
					`${logPrefix} Map load timed out for ${container.id}.`
				);
				map?.off("error", handleMapError); // Clean up listener
				map?.remove(); // Attempt to remove the map instance
				const timeoutError = new Error(
					`Map load timed out for ${container.id}`
				);
				onError({
					type: "error",
					error: timeoutError,
				} as MapErrorEvent);
				reject(timeoutError);
			}, 15000); // 15 second timeout for map load

			// Clear timeout if load succeeds
			map.once("load", () => clearTimeout(loadTimeout));
			// Clear timeout if error occurs before load
			map.once("error", () => clearTimeout(loadTimeout));
		} catch (error) {
			console.error(
				`${logPrefix} Failed to initialize map instance synchronously for ${container.id}:`,
				error
			);
			const initError =
				error instanceof Error
					? error
					: new Error("Map creation failed");
			onError({ type: "error", error: initError } as MapErrorEvent);
			reject(initError); // Reject the promise
		}
	});
}
