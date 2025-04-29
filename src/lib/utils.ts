// src/lib/utils.ts

/**
 * Converts a HEX color value to RGBA format.
 * @param hex The hex color string (e.g., "#RRGGBB").
 * @param alpha The alpha transparency value (0 to 1).
 * @returns The RGBA color string (e.g., "rgba(r, g, b, alpha)").
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
	if (!hex || typeof hex !== "string" || !hex.startsWith("#")) {
		// Return a default or transparent color if hex is invalid
		console.warn(`Invalid hex color provided to hexToRgba: ${hex}`);
		return `rgba(0, 0, 0, ${alpha})`; // Default to black with alpha
	}

	let r = 0,
		g = 0,
		b = 0;

	// 3 digits
	if (hex.length === 4) {
		r = parseInt(hex[1] + hex[1], 16);
		g = parseInt(hex[2] + hex[2], 16);
		b = parseInt(hex[3] + hex[3], 16);
	}
	// 6 digits
	else if (hex.length === 7) {
		r = parseInt(hex[1] + hex[2], 16);
		g = parseInt(hex[3] + hex[4], 16);
		b = parseInt(hex[5] + hex[6], 16);
	} else {
		// Invalid length
		console.warn(`Invalid hex color length provided to hexToRgba: ${hex}`);
		return `rgba(0, 0, 0, ${alpha})`;
	}

	// Clamp alpha value
	const validAlpha = Math.max(0, Math.min(1, alpha));

	return `rgba(${r}, ${g}, ${b}, ${validAlpha})`;
}

// --- Existing functions ---
/**
 * Retrieves a numeric value from a data object safely...
 */
export function getNumericValue(data: any, key: string): number | null {
	// ... (implementation remains the same) ...
	if (!data || !key || !(key in data)) {
		return null;
	}
	const val = data[key];
	if (val === null || val === undefined || val === "") {
		return null;
	}
	if (typeof val === "number") {
		return isNaN(val) ? null : val;
	}
	if (typeof val === "string") {
		const cleanedVal = val.replace(/,/g, "").trim();
		if (cleanedVal === "") return null;
		const parsed = parseFloat(cleanedVal);
		return isNaN(parsed) ? null : parsed;
	}
	return null;
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds...
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number = 300
): (...args: Parameters<T>) => void {
	// ... (implementation remains the same) ...
	let timeout: ReturnType<typeof setTimeout> | null = null;
	return function (...args: Parameters<T>): void {
		const later = () => {
			timeout = null;
			func(...args);
		};
		if (timeout !== null) {
			clearTimeout(timeout);
		}
		timeout = setTimeout(later, wait);
	};
}

/**
 * Formats a numeric value for display in legends or tooltips based on the label context.
 */
export function formatDisplayValue(
	value: number | null | undefined,
	labelContext: string = ""
): string {
	// ... (implementation remains the same) ...
	if (value === null || value === undefined || isNaN(Number(value))) {
		return "N/A";
	}
	const numValue = Number(value);
	if (
		labelContext.includes("(%)") ||
		labelContext.includes("Voteshare") ||
		labelContext.includes("Swing") ||
		labelContext.includes("Proportion") ||
		labelContext.includes("Share")
	) {
		if (
			numValue >= 0 &&
			numValue <= 1 &&
			!labelContext.includes("%") &&
			!labelContext.includes("Score")
		) {
			return `${(numValue * 100).toFixed(1)}%`;
		}
		return `${numValue.toFixed(1)}%`;
	}
	if (labelContext.includes("(£)") || labelContext.includes("Price")) {
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
