import type {
	LngLatBoundsLike,
	GeoJSONGeometry,
	Map as MaplibreMap,
} from "maplibre-gl";

/**
 * Calculates the bounding box of a GeoJSON geometry.
 */
export function calculateBounds(
	geometry: GeoJSONGeometry
): LngLatBoundsLike | null {
	// ... (implementation as previously provided) ...
	if (!geometry || !geometry.coordinates) return null;
	let minLng = Infinity,
		maxLng = -Infinity,
		minLat = Infinity,
		maxLat = -Infinity;
	const processRing = (ring: number[][]) => {
		/* ... */
	};
	try {
		/* ... process polygon/multipolygon ... */
	} catch (error) {
		return null;
	}
	if (
		!isFinite(minLng) ||
		!isFinite(maxLng) ||
		!isFinite(minLat) ||
		!isFinite(maxLat)
	)
		return null;
	if (minLng === maxLng) {
		maxLng += 0.001;
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

/**
 * Zooms both maps smoothly to the provided bounds.
 */
export function zoomToBounds(
	mapLeft: MaplibreMap | null,
	mapRight: MaplibreMap | null,
	bounds: LngLatBoundsLike | null
): boolean {
	if (bounds && mapLeft && mapRight) {
		const options = {
			padding: 60,
			maxZoom: 11.5,
			duration: 800,
			essential: true,
		};
		try {
			mapLeft.fitBounds(bounds, options);
			mapRight.fitBounds(bounds, options);
			return true;
		} catch (e) {
			console.error("Error during fitBounds:", e);
			return false;
		}
	}
	return false;
}
