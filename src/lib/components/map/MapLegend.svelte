<script lang="ts">
	import { formatDisplayValue } from "$lib/utils"; // Use central formatter

	// Props for left legend (Party/Swing)
	export let leftLabel: string = "";
	export let leftMinValue: number | null = null;
	export let leftMaxValue: number | null = null;

	// Props for right legend (Metric)
	export let rightLabel: string = "";
	export let rightMinValue: number | null = null;
	export let rightMaxValue: number | null = null;

	// Color scales from config
	export let partyColors: string[] = [];
	export let metricColors: string[] = [];

	// Loading/Error state
	export let isLoading: boolean = false;
	export let errorMessage: string | null = null;
</script>

{#if !isLoading && !errorMessage}
	<div
		class="grid grid-cols-1 items-start gap-x-4 gap-y-2 rounded-b-lg border-t border-gray-200/75 bg-white p-3 sm:grid-cols-2"
	>
		<!-- Left Legend (Party/Swing) -->
		<div class="text-center sm:text-left">
			<div
				class="mb-1.5 flex items-center justify-center truncate text-xs font-medium text-gray-700 sm:justify-start"
				title={leftLabel || "Party/Swing Data"}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 16 16"
					fill="currentColor"
					class="mr-1 h-3.5 w-3.5 flex-shrink-0 text-gray-400"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z"
						clip-rule="evenodd"
					></path>
				</svg>
				<span class="truncate">{leftLabel || "Party/Swing Data"}</span>
			</div>
			{#if leftMinValue !== null && leftMaxValue !== null && partyColors.length > 0}
				<div
					class="flex items-center justify-center space-x-1.5 sm:justify-start"
				>
					<span
						class="w-12 text-right text-[10px] tabular-nums text-gray-500"
						>{formatDisplayValue(leftMinValue, leftLabel)}</span
					>
					<div
						class="flex h-3.5 max-w-[140px] flex-grow overflow-hidden rounded-sm border border-gray-300/80 shadow-inner"
						aria-label="Color scale for {leftLabel}"
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
						class="w-12 text-left text-[10px] tabular-nums text-gray-500"
						>{formatDisplayValue(leftMaxValue, leftLabel)}</span
					>
				</div>
			{:else}
				<div
					class="flex h-[26px] items-center justify-center text-[10px] italic text-gray-400 sm:justify-start"
				>
					No data range
				</div>
			{/if}
		</div>

		<!-- Right Legend (Metric) -->
		<div class="text-center sm:text-right">
			<div
				class="mb-1.5 flex items-center justify-center truncate text-xs font-medium text-gray-700 sm:justify-end"
				title={rightLabel || "Metric Data"}
			>
				<span class="truncate">{rightLabel || "Metric Data"}</span>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 16 16"
					fill="currentColor"
					class="ml-1 h-3.5 w-3.5 flex-shrink-0 text-gray-400"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
						clip-rule="evenodd"
					></path>
				</svg>
			</div>
			{#if rightMinValue !== null && rightMaxValue !== null && metricColors.length > 0}
				<div
					class="flex items-center justify-center space-x-1.5 sm:justify-end"
				>
					<span
						class="w-12 text-right text-[10px] tabular-nums text-gray-500"
						>{formatDisplayValue(rightMinValue, rightLabel)}</span
					>
					<div
						class="flex h-3.5 max-w-[140px] flex-grow overflow-hidden rounded-sm border border-gray-300/80 shadow-inner"
						aria-label="Color scale for {rightLabel}"
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
						class="w-12 text-left text-[10px] tabular-nums text-gray-500"
						>{formatDisplayValue(rightMaxValue, rightLabel)}</span
					>
				</div>
			{:else}
				<div
					class="flex h-[26px] items-center justify-center text-[10px] italic text-gray-400 sm:justify-end"
				>
					No data range
				</div>
			{/if}
		</div>

		<!-- Legend Note -->
		<div
			class="col-span-1 mt-1.5 text-center text-[10px] text-gray-400 sm:col-span-2"
		>
			Colors show quintiles (approx. 20% bands based on positive values).
			Grey indicates no data or zero. Hover for details.
		</div>
	</div>
{/if}
