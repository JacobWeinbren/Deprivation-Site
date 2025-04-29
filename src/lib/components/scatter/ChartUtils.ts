export interface ResponsiveFontSizes {
	titleSize: number;
	axisTitleSize: number;
	tickSize: number;
	tooltipTitleSize: number;
	tooltipBodySize: number;
}

/**
 * Calculate appropriate font sizes based on container width
 */
export function getResponsiveFontSizes(
	width: number,
	smallBreakpoint = 640
): ResponsiveFontSizes {
	const isSmall = width < smallBreakpoint;
	return {
		titleSize: isSmall ? 14 : 16,
		axisTitleSize: isSmall ? 11 : 12,
		tickSize: isSmall ? 9 : 10,
		tooltipTitleSize: isSmall ? 11 : 13,
		tooltipBodySize: isSmall ? 10 : 11,
	};
}

/**
 * Format a label based on its context and value
 */
export function formatLegendLabel(value: number | null, label: string): string {
	if (value === null || value === undefined) return "N/A";
	const numValue = Number(value);
	if (isNaN(numValue)) return "N/A";

	// Use the provided label for context
	if (label.includes("(%)") || label.includes("Voteshare")) {
		// Handle potential 0-1 range if label doesn't explicitly have % but implies it
		if (numValue >= 0 && numValue <= 1 && !label.includes("%")) {
			return `${(numValue * 100).toFixed(1)}%`;
		}
		return `${numValue.toFixed(1)}%`;
	}
	if (label.includes("(£)")) {
		return numValue >= 1000
			? `£${(numValue / 1000).toFixed(0)}k`
			: `£${numValue.toLocaleString(undefined, {
					maximumFractionDigits: 0,
			  })}`;
	}
	if (Math.abs(numValue) < 1 && numValue !== 0) return numValue.toFixed(2);
	if (Math.abs(numValue) < 10) return numValue.toFixed(1);
	if (Math.abs(numValue) >= 10000) return (numValue / 1000).toFixed(0) + "k";
	return numValue.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
