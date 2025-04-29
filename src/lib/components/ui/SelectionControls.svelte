<script lang="ts">
	import type {
		MetricOption,
		PartyOption,
	} from "$lib/components/scatter/types"; // Corrected import path

	// Props
	export let selectedParty: string = "";
	export let selectedMetric: string = "";
	export let metrics: MetricOption[] = [];
	export let parties: PartyOption[] = [];

	// Prepare grouped metrics for dropdown
	let orderedGroupedMetrics: {
		groupName: string;
		options: { value: string; label: string }[];
	}[] = [];

	$: {
		const groupMap = new Map<string, { value: string; label: string }[]>();
		const groupOrder: string[] = [];
		metrics.forEach((metric) => {
			const group = metric.group || "Other";
			if (!groupMap.has(group)) {
				groupMap.set(group, []);
				if (!groupOrder.includes(group)) {
					// Ensure unique group order
					groupOrder.push(group);
				}
			}
			groupMap
				.get(group)
				?.push({ value: metric.value, label: metric.label });
		});
		orderedGroupedMetrics = groupOrder.map((groupName) => ({
			groupName,
			options: groupMap.get(groupName) || [],
		}));
	}
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end text-sm">
	<!-- Party Selection -->
	<div>
		<label
			for="party-select-page"
			class="block text-xs font-medium text-gray-600 mb-1.5"
		>
			Party / Left Map
		</label>
		<div class="relative">
			<select
				id="party-select-page"
				bind:value={selectedParty}
				class="block w-full pl-3 pr-8 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out hover:border-gray-400"
			>
				{#each parties as party (party.value)}
					<option value={party.value}>{party.label}</option>
				{/each}
			</select>
			<div
				class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400"
			>
				<svg
					class="w-4 h-4"
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

	<!-- Metric Selection -->
	<div>
		<label
			for="metric-select-page"
			class="block text-xs font-medium text-gray-600 mb-1.5"
		>
			Metric / Right Map
		</label>
		<div class="relative">
			<select
				id="metric-select-page"
				bind:value={selectedMetric}
				class="block w-full pl-3 pr-8 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out hover:border-gray-400"
			>
				{#each orderedGroupedMetrics as groupInfo (groupInfo.groupName)}
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
					class="w-4 h-4"
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
	/* Keep optgroup styles for better readability */
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
