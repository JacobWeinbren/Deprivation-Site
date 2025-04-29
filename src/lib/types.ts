// --- Data Structures ---
export interface ConstituencyData {
	constituency_name: string;
	const_code: string;
	// Allow any other potential keys from the CSV
	[key: string]: string | number | undefined | null;
}

// --- Configuration Options ---
export interface MetricOption {
	value: string; // Key in ConstituencyData
	label: string; // Display label
	group: string; // Group for dropdown
}

export interface PartyOption {
	value: string; // Key in ConstituencyData or special value like 'swing'
	label: string; // Display label
}

// --- Map Specific Types (Re-exported for convenience if needed elsewhere) ---
export type {
	Map as MaplibreMap,
	MapOptions,
	LngLatLike,
	LngLatBoundsLike,
	ErrorEvent as MapErrorEvent, // Renamed to avoid conflict
	MapDataEvent,
	MapMouseEvent,
	Popup as MaplibrePopup,
	GeoJSONGeometry,
	NavigationControl,
} from "maplibre-gl";

// --- Chart Specific Types (Re-exported for convenience) ---
export type {
	ChartConfiguration,
	ChartOptions,
	Point,
	TooltipCallbacks,
	FontSpec,
	Chart as ChartJSChart, // Renamed to avoid conflict
} from "chart.js";

// --- Utility Function Types ---
export type SimpleStatistics = typeof import("simple-statistics");
