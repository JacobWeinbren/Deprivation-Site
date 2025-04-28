<!-- src/routes/+page.svelte -->
<script lang="ts">
	import ConstituencyScatter from "$lib/components/scatter/ConstituencyScatter.svelte";
	import type { PageData } from "./$types"; // Keep this import

	// Data loaded from +page.server.ts
	export let data: PageData;

	// Access properties directly from data - PageData should guarantee their existence
	// SvelteKit's type generation defines PageData based on the load function's return
	// Optional chaining (?.) adds safety if data itself could be undefined,
	// though in standard SvelteKit flow, it should be an object.
	const chartData = data?.chartData ?? [];
	const error = data?.error ?? null;
</script>

<svelte:head>
	<title>Constituency Data Explorer</title>
	<meta
		name="description"
		content="Explore relationships between voting patterns and deprivation metrics."
	/>
</svelte:head>

<main class="container mx-auto p-4">
	<h1 class="text-2xl font-bold text-center mb-6">
		British Constituency Data Explorer
	</h1>

	{#if error}
		<div
			class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative max-w-3xl mx-auto"
			role="alert"
		>
			<strong class="font-bold">Error:</strong>
			<span class="block sm:inline">{error}</span>
		</div>
	{:else if chartData && chartData.length > 0}
		<!-- Pass the loaded data to the component -->
		<ConstituencyScatter data={chartData} />
	{:else if !error}
		<!-- Handle case where data is empty but no specific error was thrown -->
		<div
			class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative max-w-3xl mx-auto"
			role="alert"
		>
			<strong class="font-bold">No Data:</strong>
			<span class="block sm:inline"
				>No constituency data could be loaded or the file is empty.
				Check server logs.</span
			>
		</div>
	{/if}
</main>
