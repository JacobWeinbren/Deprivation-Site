<script lang="ts">
	export let activeTab: "scatter" | "compare" = "scatter";
</script>

<div class="flex justify-center mb-6 sm:mb-8">
	<div
		class="inline-flex bg-gray-100 p-1 rounded-lg border border-gray-200/75 space-x-1"
		role="tablist"
		aria-label="Select view"
	>
		<button
			role="tab"
			aria-selected={activeTab === "scatter"}
			aria-controls="scatter-panel"
			id="scatter-tab"
			class="py-1.5 px-5 text-sm font-medium focus:outline-none rounded-md transition-all duration-150 ease-in-out focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 {activeTab ===
			'scatter'
				? 'bg-white text-blue-700 shadow-sm'
				: 'text-gray-600 hover:text-gray-800 hover:bg-gray-200/60'}"
			on:click={() => (activeTab = "scatter")}
		>
			Scatter
		</button>
		<button
			role="tab"
			aria-selected={activeTab === "compare"}
			aria-controls="compare-panel"
			id="compare-tab"
			class="py-1.5 px-5 text-sm font-medium focus:outline-none rounded-md transition-all duration-150 ease-in-out focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 {activeTab ===
			'compare'
				? 'bg-white text-blue-700 shadow-sm'
				: 'text-gray-600 hover:text-gray-800 hover:bg-gray-200/60'}"
			on:click={() => (activeTab = "compare")}
		>
			Compare Maps
		</button>
	</div>
</div>
