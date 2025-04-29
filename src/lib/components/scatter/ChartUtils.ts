import { formatDisplayValue } from "$lib/utils"; // Use centralized formatter

export interface ResponsiveFontSizes {
	titleSize: number;
	axisTitleSize: number;
	tickSize: number;
	tooltipTitleSize: number;
	tooltipBodySize: number;
}

// Define font sizes for different breakpoints
const DEFAULT_FONT_SIZES: ResponsiveFontSizes = {
	titleSize: 16,
	axisTitleSize: 12,
	tickSize: 10,
	tooltipTitleSize: 12, // Slightly smaller tooltip title
	tooltipBodySize: 11,
};
const SMALL_FONT_SIZES: ResponsiveFontSizes = {
	titleSize: 14,
	axisTitleSize: 11,
	tickSize: 9,
	tooltipTitleSize: 11,
	tooltipBodySize: 10,
};

/**
 * Calculate appropriate font sizes based on container width.
 * Returns a valid ResponsiveFontSizes object.
 */
export function getResponsiveFontSizes(
	width: number | null | undefined,
	smallBreakpoint = 640
): ResponsiveFontSizes {
	const validWidth = typeof width === "number" && isFinite(width) ? width : 0;
	const isSmall = validWidth > 0 && validWidth < smallBreakpoint;
	// Return copies to prevent mutation
	return isSmall ? { ...SMALL_FONT_SIZES } : { ...DEFAULT_FONT_SIZES };
}

/**
 * Wrapper function for formatting legend/axis labels using the central formatter.
 * Kept for potential future chart-specific formatting rules.
 */
export function formatChartLabel(
	value: number | null | undefined,
	labelContext: string = ""
): string {
	return formatDisplayValue(value, labelContext);
}
