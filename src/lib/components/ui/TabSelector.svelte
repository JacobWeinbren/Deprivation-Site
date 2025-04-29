<script lang="ts">
	export let activeTab: "scatter" | "compare" = "scatter";
</script>

<div class="mb-6 flex justify-center sm:mb-8">
	<div
		class="inline-flex space-x-1 rounded-lg border border-gray-200/75 bg-gray-100 p-1"
		role="tablist"
		aria-label="Select view"
	>
		<button
			role="tab"
			aria-selected={activeTab === "scatter"}
			aria-controls="scatter-panel"
			id="scatter-tab"
			class="rounded-md px-5 py-1.5 text-sm font-medium transition-all duration-150 ease-in-out focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 {activeTab ===
			'scatter'
				? 'bg-white text-blue-700 shadow-sm'
				: 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-800'}"
			on:click={() => (activeTab = "scatter")}
		>
			Scatter
		</button>
		<button
			role="tab"
			aria-selected={activeTab === "compare"}
			aria-controls="compare-panel"
			id="compare-tab"
			class="rounded-md px-5 py-1.5 text-sm font-medium transition-all duration-150 ease-in-out focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 {activeTab ===
			'compare'
				? 'bg-white text-blue-700 shadow-sm'
				: 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-800'}"
			on:click={() => (activeTab = "compare")}
		>
			Compare Maps
		</button>
	</div>
</div>
