type ChartJS = typeof import("chart.js");
type SimpleStatistics = typeof import("simple-statistics");

declare global {
	interface Window {
		Chart?: ChartJS["Chart"];
		ss?: SimpleStatistics;
	}
}

/**
 * Loads Chart.js and simple-statistics libraries dynamically if not already present.
 */
export async function loadChartLibraries(): Promise<{
	Chart: ChartJS["Chart"];
	ss: SimpleStatistics;
} | null> {
	if (window.Chart && window.ss?.linearRegression) {
		return { Chart: window.Chart, ss: window.ss };
	}
	try {
		const [chartModule, simpleStatsModule] = await Promise.all([
			window.Chart
				? Promise.resolve({
						Chart: window.Chart,
						register: window.Chart.register,
				  })
				: import("chart.js/auto"),
			window.ss
				? Promise.resolve(window.ss)
				: import("simple-statistics"),
		]);
		if (!window.Chart && chartModule.Chart)
			window.Chart = chartModule.Chart;
		else if (!window.Chart)
			throw new Error(
				"Chart.js module loaded but Chart class not found."
			);
		if (!window.ss && simpleStatsModule) window.ss = simpleStatsModule;
		else if (!window.ss)
			throw new Error(
				"Simple-statistics module loaded but not assigned."
			);
		if (!window.Chart || typeof window.ss?.linearRegression !== "function")
			throw new Error("Libraries loaded but failed validation check.");
		console.log("Scatter: Chart libraries loaded successfully.");
		return { Chart: window.Chart, ss: window.ss };
	} catch (e) {
		console.error("Failed to load chart libraries:", e);
		return null;
	}
}
