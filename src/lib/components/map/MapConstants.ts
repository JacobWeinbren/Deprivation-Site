// Shared constants for map functionality
export const SOURCE_ID_LEFT = "constituencies-source-left";
export const LAYER_ID_LEFT = "constituency-fills-left";
export const SOURCE_ID_RIGHT = "constituencies-source-right";
export const LAYER_ID_RIGHT = "constituency-fills-right";
export const SOURCE_LAYER = "uk-constituencies";
export const FEATURE_ID_PROPERTY = "PCON24CD"; // ID property in vector tiles
export const FEATURE_NAME_PROPERTY = "PCON24NM"; // Name property in vector tiles
export const NO_DATA_COLOR = "#e0e0e0";

// Color palettes for maps
export const metricQuintileColors = [
	"#d73027", // Red-orange (Low)
	"#fc8d59", // Light orange
	"#f7f7f7", // Off-White (Mid)
	"#91bfdb", // Light blue
	"#2166ac", // Deep blue (High)
];

export const partyQuintileColors = [
	"#1b9e77", // Teal green (Low)
	"#66c2a5", // Light green
	"#f7f7f7", // Off-White (Mid)
	"#d1b3d9", // Light purple
	"#7b3294", // Deep purple (High)
];

// UK default center and extent
export const UK_DEFAULT_CENTER: [number, number] = [-2, 54.5];
export const UK_DEFAULT_ZOOM = 5;

// Minimal map style
export const minimalStyle = {
	version: 8,
	sources: {},
	layers: [],
};
