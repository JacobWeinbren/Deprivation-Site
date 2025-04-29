/**
 * Retrieves a numeric value from a data object safely, handling nulls, undefined,
 * empty strings, and attempting to parse strings (removing commas).
 */
export function getNumericValue(data: any, key: string): number | null {
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
	// console.warn(`Unexpected type for key ${key}: ${typeof val}`);
	return null;
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number = 300
): (...args: Parameters<T>) => void {
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
	if (value === null || value === undefined || isNaN(Number(value))) {
		return "N/A";
	}

	const numValue = Number(value);

	// Percentage formatting
	if (
		labelContext.includes("(%)") ||
		labelContext.includes("Voteshare") ||
		labelContext.includes("Swing") ||
		labelContext.includes("Proportion") ||
		labelContext.includes("Share")
	) {
		// Handle potential 0-1 range if not explicitly marked with %
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

	// Currency formatting
	if (labelContext.includes("(£)") || labelContext.includes("Price")) {
		return numValue >= 1000
			? `£${(numValue / 1000).toFixed(0)}k`
			: `£${numValue.toLocaleString(undefined, {
					maximumFractionDigits: 0,
			  })}`;
	}

	// General number formatting
	if (Math.abs(numValue) < 1 && numValue !== 0) return numValue.toFixed(2);
	if (Math.abs(numValue) < 10) return numValue.toFixed(1);
	if (Math.abs(numValue) >= 10000) return (numValue / 1000).toFixed(0) + "k";

	return numValue.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
