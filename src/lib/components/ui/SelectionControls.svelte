<script lang="ts">
	import type { MetricOption } from "$lib/types";
	// Import the new structure and types from your config file
	import { partyGroups, type PartyGroup } from "$lib/config"; // Adjust path as needed

	export let selectedParty: string = "";
	export let selectedMetric: string = "";
	export let metrics: MetricOption[] = [];
	// Remove the old 'parties' prop: export let parties: PartyOption[] = [];

	// Prepare grouped metrics for the dropdown (This part remains the same)
	$: groupedMetrics = (() => {
		const groupMap = new Map<string, { value: string; label: string }[]>();
		const groupOrder: string[] = [];
		metrics.forEach((metric) => {
			const group = metric.group || "Other";
			if (!groupMap.has(group)) {
				groupMap.set(group, []);
				if (!groupOrder.includes(group)) {
					groupOrder.push(group);
				}
			}
			groupMap
				.get(group)
				?.push({ value: metric.value, label: metric.label });
		});
		return groupOrder.map((groupName) => ({
			groupName,
			options: groupMap.get(groupName) || [],
		}));
	})();
</script>

<div class="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
	<!-- Party/Swing Selection (Updated) -->
	<div>
		<label
			for="party-select"
			class="mb-1.5 block text-xs font-medium text-gray-600"
		>
			Politics / Left Map
		</label>
		<div class="relative">
			<select
				id="party-select"
				bind:value={selectedParty}
				class="block w-full appearance-none rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm shadow-sm transition duration-150 ease-in-out hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			>
				<!-- Iterate through partyGroups -->
				{#each partyGroups as groupInfo (groupInfo.groupName)}
					<optgroup label={groupInfo.groupName}>
						{#each groupInfo.options as party (party.value)}
							<option value={party.value}>{party.label}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
			<div
				class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400"
			>
				<svg
					class="h-4 w-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					stroke-width="2"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M8 9l4-4 4 4m0 6l-4 4-4-4"
					></path>
				</svg>
			</div>
		</div>
	</div>

	<!-- Metric Selection (Remains the same) -->
	<div>
		<label
			for="metric-select"
			class="mb-1.5 block text-xs font-medium text-gray-600"
		>
			Metric / Right Map
		</label>
		<div class="relative">
			<select
				id="metric-select"
				bind:value={selectedMetric}
				class="block w-full appearance-none rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm shadow-sm transition duration-150 ease-in-out hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			>
				{#each groupedMetrics as groupInfo (groupInfo.groupName)}
					<optgroup label={groupInfo.groupName}>
						{#each groupInfo.options as metric (metric.value)}
							<option value={metric.value}>{metric.label}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
			<div
				class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400"
			>
				<svg
					class="h-4 w-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					stroke-width="2"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M8 9l4-4 4 4m0 6l-4 4-4-4"
					></path>
				</svg>
			</div>
		</div>
	</div>
</div>

<style>
	select optgroup {
		font-weight: 500;
		font-style: normal;
		color: #4b5563; /* gray-600 */
		background-color: #f9fafb; /* gray-50 */
		padding: 4px 8px;
		font-size: 0.8rem;
		margin-top: 4px;
	}
	select optgroup option {
		font-weight: normal;
		background-color: #ffffff;
		color: #1f2937; /* gray-800 */
		padding: 4px 12px;
	}
</style>
