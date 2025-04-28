// src/lib/components/scatter/utils.ts
import type { ConstituencyData } from "./chartConfig";

/**
 * Safely extracts a numeric value from a data row object.
 * @param row The data object.
 * @param key The key to extract the value from.
 * @returns The numeric value or null if invalid/missing.
 */
export function getNumericValue(
	row: ConstituencyData | null | undefined,
	key: string
): number | null {
	const value = row ? row[key] : null;
	if (value === null || value === undefined || value === "") return null;
	const num = Number(value);
	return Number.isFinite(num) ? num : null;
}

/**
 * Creates a debounced version of a function that delays invoking the function
 * until after `wait` milliseconds have elapsed since the last time the
 * debounced function was invoked.
 * @param func The function to debounce.
 * @param wait The number of milliseconds to delay.
 * @returns The debounced function.
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: number | undefined;

	return function executedFunction(...args: Parameters<T>) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};

		clearTimeout(timeout);
		timeout = window.setTimeout(later, wait);
	};
}
