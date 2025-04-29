// Shared constants for map functionality
export const SOURCE_ID_LEFT = "constituencies-source-left";
export const LAYER_ID_LEFT = "constituency-fills-left";
export const SOURCE_ID_RIGHT = "constituencies-source-right";
export const LAYER_ID_RIGHT = "constituency-fills-right";
export const SOURCE_LAYER = "uk-constituencies";
export const FEATURE_ID_PROPERTY = "PCON24CD"; // ID property in vector tiles
export const FEATURE_NAME_PROPERTY = "PCON24NM"; // Name property in vector tiles

// --- Color Palettes ---

// Orange-Yellow-Blue Diverging Scheme (5-class) - Adjusted middle
export const metricQuintileColors = [
	"#b35806", // Brown/Orange (Low values)
	"#f1a340", // Light Orange
	"#fff6cf", // Pale Yellow (Middle values - replaces grey/white) - Lighter than previous yellow
	"#998ec3", // Light Purple/Blue
	"#542788", // Purple/Blue (High values)
];

// Party comparison uses Green-Purple
export const partyQuintileColors = [
	"#1b9e77", // Teal green (Low)
	"#66c2a5", // Light green
	"#f7f7f7", // Off-White (Mid)
	"#d1b3d9", // Light purple
	"#7b3294", // Deep purple (High)
];

// Color for features with no data or zero values (unless zero is meaningful)
export const NO_DATA_COLOR = "#e0e0e0";

// --- Map Defaults ---
export const UK_DEFAULT_CENTER: [number, number] = [-2, 54.5];
export const UK_DEFAULT_ZOOM = 5;
export const minimalStyle = { version: 8, sources: {}, layers: [] };
