<script lang="ts">
	import { formatLegendLabel } from "$lib/components/scatter/ChartUtils";

	// Props for left legend
	export let leftLabel: string = "";
	export let leftMinValue: number | null = null;
	export let leftMaxValue: number | null = null;

	// Props for right legend
	export let rightLabel: string = "";
	export let rightMinValue: number | null = null;
	export let rightMaxValue: number | null = null;

	// Color scales
	export let partyColors: string[] = [];
	export let metricColors: string[] = [];

	// Loading state
	export let isLoading: boolean = false;
	export let errorMessage: string | null = null;

	function formatMinMaxLabel(value: number | null, label: string): string {
		// Use a slightly simpler formatter for min/max labels if needed
		return formatLegendLabel(value, label);
	}
</script>

{#if !isLoading && !errorMessage}
	<div
		class="bg-white p-3 rounded-b-lg border-t border-gray-200/75 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 items-start"
	>
		<!-- Left Legend (Party) -->
		<div class="text-center sm:text-left">
			<div
				class="text-xs font-medium text-gray-700 mb-1.5 truncate flex items-center justify-center sm:justify-start"
				title={leftLabel || "Party Data"}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 16 16"
					fill="currentColor"
					class="w-3.5 h-3.5 mr-1 text-gray-400 flex-shrink-0"
				>
					<path
						fill-rule="evenodd"
						d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z"
						clip-rule="evenodd"
					/>
				</svg>
				<span class="truncate">{leftLabel || "Party Data"}</span>
			</div>
			{#if leftMinValue !== null && leftMaxValue !== null && partyColors.length > 0}
				<div
					class="flex items-center justify-center sm:justify-start space-x-1.5"
				>
					<span
						class="text-[10px] text-gray-500 w-10 text-right tabular-nums"
						>{formatMinMaxLabel(leftMinValue, leftLabel)}</span
					>
					<div
						class="flex h-3.5 flex-grow max-w-[140px] rounded-sm overflow-hidden border border-gray-300/80 shadow-inner"
					>
						{#each partyColors as color, i (i)}
							<div
								class="flex-1"
								style:background-color={color}
								title={`Quintile ${i + 1}`}
							></div>
						{/each}
					</div>
					<span
						class="text-[10px] text-gray-500 w-10 text-left tabular-nums"
						>{formatMinMaxLabel(leftMaxValue, leftLabel)}</span
					>
				</div>
			{:else}
				<div
					class="text-[10px] text-gray-400 italic h-[26px] flex items-center justify-center sm:justify-start"
				>
					No data range
				</div>
			{/if}
		</div>

		<!-- Right Legend (Metric) -->
		<div class="text-center sm:text-right">
			<div
				class="text-xs font-medium text-gray-700 mb-1.5 truncate flex items-center justify-center sm:justify-end"
				title={rightLabel || "Metric Data"}
			>
				<span class="truncate">{rightLabel || "Metric Data"}</span>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 16 16"
					fill="currentColor"
					class="w-3.5 h-3.5 ml-1 text-gray-400 flex-shrink-0"
				>
					<path
						fill-rule="evenodd"
						d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
						clip-rule="evenodd"
					/>
				</svg>
			</div>
			{#if rightMinValue !== null && rightMaxValue !== null && metricColors.length > 0}
				<div
					class="flex items-center justify-center sm:justify-end space-x-1.5"
				>
					<span
						class="text-[10px] text-gray-500 w-10 text-right tabular-nums"
						>{formatMinMaxLabel(rightMinValue, rightLabel)}</span
					>
					<div
						class="flex h-3.5 flex-grow max-w-[140px] rounded-sm overflow-hidden border border-gray-300/80 shadow-inner"
					>
						{#each metricColors as color, i (i)}
							<div
								class="flex-1"
								style:background-color={color}
								title={`Quintile ${i + 1}`}
							></div>
						{/each}
					</div>
					<span
						class="text-[10px] text-gray-500 w-10 text-left tabular-nums"
						>{formatMinMaxLabel(rightMaxValue, rightLabel)}</span
					>
				</div>
			{:else}
				<div
					class="text-[10px] text-gray-400 italic h-[26px] flex items-center justify-center sm:justify-end"
				>
					No data range
				</div>
			{/if}
		</div>

		<div
			class="col-span-1 sm:col-span-2 text-center text-[10px] text-gray-400 mt-1.5"
		>
			Colors show quintiles (approx. 20% bands). Grey indicates no data or
			zero. Hover for details.
		</div>
	</div>
{/if}
