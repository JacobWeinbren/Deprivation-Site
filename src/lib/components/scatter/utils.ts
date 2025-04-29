/**
 * Retrieves a numeric value from a data object safely
 */
export function getNumericValue(data: any, key: string): number | null {
	if (!data || !key) return null;

	// Handle non-existent property
	if (!(key in data)) return null;

	const val = data[key];

	// Handle null/undefined
	if (val === null || val === undefined) return null;

	// Handle already numeric values
	if (typeof val === "number") return isNaN(val) ? null : val;

	// Handle string values by converting to number
	if (typeof val === "string") {
		const parsed = parseFloat(val);
		return isNaN(parsed) ? null : parsed;
	}

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

		if (timeout !== null) {
			clearTimeout(timeout);
		}
		timeout = setTimeout(later, wait);
	};
}
