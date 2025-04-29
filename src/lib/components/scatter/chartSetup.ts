import type { ChartJSChart, SimpleStatistics } from "$lib/types";

// Define types for Chart.js and simple-statistics modules
type ChartJSModule = typeof import("chart.js/auto");
type SimpleStatisticsModule = typeof import("simple-statistics");

declare global {
	interface Window {
		Chart?: ChartJSChart; // Use the renamed type
		ss?: SimpleStatistics;
	}
}

/**
 * Loads Chart.js and simple-statistics libraries dynamically if not already present.
 * Uses window properties as a cache.
 */
export async function loadChartLibraries(): Promise<{
	Chart: typeof ChartJSChart;
	ss: SimpleStatistics;
} | null> {
	// Check cache first
	if (window.Chart && window.ss?.linearRegression) {
		return { Chart: window.Chart, ss: window.ss };
	}

	try {
		// Load libraries concurrently
		const [chartModule, simpleStatsModule] = await Promise.all([
			window.Chart
				? Promise.resolve({ Chart: window.Chart }) // Already loaded
				: import("chart.js/auto"),
			window.ss
				? Promise.resolve(window.ss)
				: import("simple-statistics"), // Already loaded
		]);

		// Assign to window cache if not already present
		if (!window.Chart) {
			const Chart = (chartModule as ChartJSModule)?.Chart;
			if (!Chart)
				throw new Error(
					"Chart.js module loaded but Chart class not found."
				);
			window.Chart = Chart;
		}

		if (!window.ss) {
			const ss = (simpleStatsModule as SimpleStatisticsModule)?.default // Handle potential default export
				? (simpleStatsModule as SimpleStatisticsModule).default
				: simpleStatsModule;
			if (typeof ss?.linearRegression !== "function")
				throw new Error(
					"Simple-statistics module loaded but not assigned correctly or lacks expected functions."
				);
			window.ss = ss;
		}

		// Final validation after potential assignment
		if (
			!window.Chart ||
			typeof window.ss?.linearRegression !== "function"
		) {
			throw new Error(
				"Libraries loaded but failed final validation check."
			);
		}

		console.log("Scatter: Chart libraries loaded successfully.");
		return { Chart: window.Chart, ss: window.ss };
	} catch (e) {
		console.error("Failed to load chart libraries:", e);
		// Clear potentially partially loaded libraries from window on error
		delete window.Chart;
		delete window.ss;
		return null;
	}
}
