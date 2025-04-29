/**
 * Retrieves a numeric value from a data object safely
 */
export function getNumericValue(data: any, key: string): number | null {
	if (!data || !key || !(key in data)) return null;
	const val = data[key];
	if (val === null || val === undefined || val === "") return null; // Also treat empty string as null
	if (typeof val === "number") return isNaN(val) ? null : val;
	if (typeof val === "string") {
		const cleanedVal = val.replace(/,/g, "").trim(); // Remove commas before parsing
		if (cleanedVal === "") return null;
		const parsed = parseFloat(cleanedVal);
		return isNaN(parsed) ? null : parsed;
	}
	// console.warn(`Unexpected type for key ${key}: ${typeof val}`);
	return null;
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
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
		if (timeout !== null) clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}
