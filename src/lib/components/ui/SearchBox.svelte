<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import type { ConstituencyData } from "$lib/components/scatter/types"; // Corrected import path

	// Props
	export let data: ConstituencyData[] = [];
	export let searchTerm: string = "";
	export let highlightedConstituency: string | null = null;

	// Refs
	export let searchInput: HTMLInputElement; // For binding

	// State
	let searchResults: ConstituencyData[] = [];
	let showSearchResults = false;

	const dispatch = createEventDispatcher<{
		select: ConstituencyData | null;
		reset: void;
	}>();

	// Reactive search
	$: {
		if (searchTerm.length > 1) {
			const term = searchTerm.toLowerCase().trim();
			searchResults = data
				.filter((d) =>
					d.constituency_name?.toLowerCase().includes(term)
				)
				.sort((a, b) =>
					a.constituency_name.localeCompare(b.constituency_name)
				)
				.slice(0, 7); // Limit results
			showSearchResults = searchResults.length > 0;
		} else {
			searchResults = [];
			showSearchResults = false;
		}
	}

	function selectConstituency(constituency: ConstituencyData | null) {
		dispatch("select", constituency);
		searchTerm = "";
		searchResults = [];
		showSearchResults = false;
		searchInput?.blur(); // Blur input after selection
	}

	function handleSearchFocus() {
		if (searchTerm.length > 1 && searchResults.length > 0) {
			showSearchResults = true;
		}
	}

	function handleSearchBlur() {
		// Delay hiding results slightly to allow click on result
		setTimeout(() => {
			// Check if the focus moved to a result button before hiding
			if (!document.activeElement?.closest(".search-result-button")) {
				showSearchResults = false;
			}
		}, 150);
	}
</script>

<div class="relative">
	<label
		for="search-input-page"
		class="block text-xs font-medium text-gray-600 mb-1.5"
	>
		Find & Highlight
	</label>
	<div class="relative">
		<div
			class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"
		>
			<svg
				class="w-4 h-4 text-gray-400"
				fill="currentColor"
				viewBox="0 0 20 20"
			>
				<path
					fill-rule="evenodd"
					d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
					clip-rule="evenodd"
				></path>
			</svg>
		</div>
		<input
			bind:this={searchInput}
			id="search-input-page"
			type="text"
			placeholder="Search constituency..."
			bind:value={searchTerm}
			on:focus={handleSearchFocus}
			on:blur={handleSearchBlur}
			class="block w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out hover:border-gray-400 placeholder-gray-400"
			aria-label="Search for a constituency"
			autocomplete="off"
			aria-haspopup="listbox"
			aria-expanded={showSearchResults}
		/>
	</div>
	<!-- Search Results -->
	{#if showSearchResults}
		<div
			class="absolute z-20 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-auto py-1 text-sm"
			role="listbox"
			aria-labelledby="search-input-page"
		>
			{#if searchResults.length > 0}
				{#each searchResults as result (result.const_code)}
					<button
						role="option"
						aria-selected="false"
						class="search-result-button block w-full text-left px-3 py-2 text-gray-700 hover:bg-blue-50 focus:outline-none focus:bg-blue-100 transition duration-150 ease-in-out"
						on:click={() => selectConstituency(result)}
						on:mousedown|preventDefault
					>
						{result.constituency_name}
					</button>
				{/each}
			{:else if searchTerm}
				<div class="px-3 py-2 text-gray-500 italic text-xs">
					No results found.
				</div>
			{/if}
		</div>
	{/if}
</div>
