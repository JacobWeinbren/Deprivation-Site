import type {
	LngLatBoundsLike,
	GeoJSONGeometry,
	MaplibreMap,
	PointLike,
} from "$lib/types";

/**
 * Calculates the bounding box of a GeoJSON geometry (Polygon or MultiPolygon).
 * Handles potential coordinate nesting.
 */
export function calculateBounds(
	geometry: GeoJSONGeometry | null | undefined
): LngLatBoundsLike | null {
	if (!geometry || !geometry.coordinates) return null;

	let minLng = Infinity,
		maxLng = -Infinity,
		minLat = Infinity,
		maxLat = -Infinity;

	// Helper to process a single ring (array of [lng, lat] points)
	const processRing = (ring: number[][]) => {
		for (const point of ring) {
			if (point.length >= 2) {
				const [lng, lat] = point;
				if (isFinite(lng) && isFinite(lat)) {
					minLng = Math.min(minLng, lng);
					maxLng = Math.max(maxLng, lng);
					minLat = Math.min(minLat, lat);
					maxLat = Math.max(maxLat, lat);
				}
			}
		}
	};

	// Helper to process coordinates which might be nested
	const processCoords = (coords: any[]) => {
		if (
			!Array.isArray(coords) ||
			coords.length === 0 ||
			!Array.isArray(coords[0])
		) {
			return; // Invalid structure
		}
		// Check if the first element is a number (likely a point) or another array (likely a ring or polygon)
		if (typeof coords[0][0] === "number") {
			// It's a ring (array of points)
			processRing(coords as number[][]);
		} else if (Array.isArray(coords[0][0])) {
			// It's nested (like Polygon or MultiPolygon), recurse
			coords.forEach(processCoords);
		}
	};

	try {
		processCoords(geometry.coordinates);
	} catch (error) {
		console.error("Error processing geometry coordinates:", error);
		return null;
	}

	// Check if any valid coordinates were found
	if (
		!isFinite(minLng) ||
		!isFinite(maxLng) ||
		!isFinite(minLat) ||
		!isFinite(maxLat)
	) {
		return null; // No valid points found
	}

	// Add slight padding if bounds are a single point
	const padding = 0.001;
	if (minLng === maxLng) {
		maxLng += padding;
		minLng -= padding;
	}
	if (minLat === maxLat) {
		maxLat += padding;
		minLat -= padding;
	}

	return [
		[minLng, minLat], // Southwest corner
		[maxLng, maxLat], // Northeast corner
	];
}

/**
 * Zooms both maps smoothly to the provided bounds with padding.
 */
export function zoomToBounds(
	mapLeft: MaplibreMap | null,
	mapRight: MaplibreMap | null,
	bounds: LngLatBoundsLike | null
): boolean {
	if (!bounds || !mapLeft || !mapRight) {
		return false;
	}

	const options = {
		padding: { top: 60, bottom: 60, left: 60, right: 60 } as PointLike, // More specific padding
		maxZoom: 10,
		duration: 800, // Animation duration
		essential: true, // Consider this animation essential
	};

	try {
		// Check if maps are ready (style loaded) before fitting bounds
		if (mapLeft.isStyleLoaded() && mapRight.isStyleLoaded()) {
			mapLeft.fitBounds(bounds, options);
			mapRight.fitBounds(bounds, options);
			return true;
		} else {
			console.warn("zoomToBounds called before map styles loaded.");
			// Optionally, queue the zoom for after style load
			mapLeft.once("idle", () => mapLeft.fitBounds(bounds, options));
			mapRight.once("idle", () => mapRight.fitBounds(bounds, options));
			return false; // Indicate zoom is deferred
		}
	} catch (e) {
		console.error("Error during fitBounds:", e);
		return false;
	}
}
