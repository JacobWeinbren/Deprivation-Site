// Re-export types and configurations
export type { ConstituencyData, MetricOption, PartyOption } from "./types";
export { metrics } from "./metricConfig";
export { parties, partyColors } from "./partyConfig";

// --- Utility function for grouped metrics ---
import type { MetricOption } from "./types";
import { metrics } from "./metricConfig";

export function getGroupedMetrics(
	metricList: MetricOption[]
): Map<string, { value: string; label: string }[]> {
	const newGroupedMetrics = new Map<
		string,
		{ value: string; label: string }[]
	>();
	metricList.forEach((metric) => {
		const group = metric.group || "Other"; // Fallback group
		if (!newGroupedMetrics.has(group)) {
			newGroupedMetrics.set(group, []);
		}
		newGroupedMetrics
			.get(group)
			?.push({ value: metric.value, label: metric.label });
	});
	// Keep original order from the metrics array
	const orderedMap = new Map<string, { value: string; label: string }[]>();
	const groupOrder: string[] = [];
	metricList.forEach((metric) => {
		const group = metric.group || "Other";
		if (!groupOrder.includes(group)) {
			groupOrder.push(group);
		}
	});
	groupOrder.forEach((groupName) => {
		if (newGroupedMetrics.has(groupName)) {
			orderedMap.set(groupName, newGroupedMetrics.get(groupName)!);
		}
	});
	return orderedMap;
}

export const groupedMetrics = getGroupedMetrics(metrics);
