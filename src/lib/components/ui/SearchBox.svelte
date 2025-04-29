<script lang="ts">
	import { createEventDispatcher, tick } from "svelte";
	import type { ConstituencyData } from "$lib/types";

	export let data: ConstituencyData[] = [];
	export let searchTerm: string = "";
	// We still receive highlightedConstituency to know *if* something is highlighted,
	// but we won't use it to directly modify searchTerm anymore.
	export let highlightedConstituency: string | null = null;
	export let searchInput: HTMLInputElement; // Bound from parent

	let searchResults: ConstituencyData[] = [];
	let showSearchResults = false;
	let activeIndex = -1; // For keyboard navigation

	const dispatch = createEventDispatcher<{
		select: ConstituencyData | null;
	}>();

	// --- Reactive Filtering based *only* on searchTerm ---
	$: {
		if (searchTerm.length > 1) {
			const term = searchTerm.toLowerCase().trim();
			// Filter results based on the typed term
			searchResults = data
				.filter((d) =>
					d.constituency_name?.toLowerCase().includes(term)
				)
				.sort((a, b) =>
					a.constituency_name.localeCompare(b.constituency_name)
				)
				.slice(0, 7); // Limit results

			// Show results ONLY if there are results AND the search term
			// doesn't exactly match the currently highlighted constituency
			// (prevents dropdown showing if user types the highlighted name)
			showSearchResults =
				searchResults.length > 0 &&
				searchTerm !== highlightedConstituency;

			activeIndex = -1; // Reset keyboard nav index
		} else {
			// Clear results if search term is short
			searchResults = [];
			showSearchResults = false;
		}
	}

	// --- Selection from Search Results ---
	async function selectConstituency(constituency: ConstituencyData | null) {
		dispatch("select", constituency); // Dispatch selection to parent (parent handles highlight)
		searchTerm = ""; // *** Clear the search term after selection ***
		searchResults = [];
		showSearchResults = false;
		await tick(); // Wait for DOM update
		searchInput?.blur(); // Blur after clearing and hiding
	}

	// --- Focus/Blur Handlers ---
	function handleFocus() {
		// Show results on focus only if term is long enough, results exist,
		// and term doesn't match current highlight
		if (
			searchTerm.length > 1 &&
			searchResults.length > 0 &&
			searchTerm !== highlightedConstituency
		) {
			showSearchResults = true;
		}
	}

	function handleBlur() {
		// Delay hiding results to allow click/selection
		setTimeout(() => {
			if (!document.activeElement?.closest(".search-result-item")) {
				showSearchResults = false;
			}
		}, 150);
	}

	// --- Keyboard Navigation ---
	function handleKeydown(event: KeyboardEvent) {
		if (!showSearchResults || searchResults.length === 0) return;

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				activeIndex = (activeIndex + 1) % searchResults.length;
				scrollIntoViewIfNeeded();
				break;
			case "ArrowUp":
				event.preventDefault();
				activeIndex =
					(activeIndex - 1 + searchResults.length) %
					searchResults.length;
				scrollIntoViewIfNeeded();
				break;
			case "Enter":
			case "Tab":
				if (activeIndex >= 0) {
					event.preventDefault();
					selectConstituency(searchResults[activeIndex]);
				}
				break;
			case "Escape":
				showSearchResults = false;
				activeIndex = -1;
				searchInput?.blur();
				break;
		}
	}

	function scrollIntoViewIfNeeded() {
		const element = document.getElementById(`search-result-${activeIndex}`);
		element?.scrollIntoView({ block: "nearest" });
	}

	// --- REMOVED REACTIVE LINKS between searchTerm and highlightedConstituency ---
	// $: if (highlightedConstituency && searchTerm !== highlightedConstituency) { ... } // REMOVED
	// $: if (highlightedConstituency === null && searchTerm !== "") { ... } // REMOVED
</script>

<div class="relative">
	<label
		for="search-input"
		class="mb-1.5 block text-xs font-medium text-gray-600"
	>
		Find & Highlight
	</label>
	<div class="relative">
		<div
			class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
		>
			<svg
				class="h-4 w-4 text-gray-400"
				fill="currentColor"
				viewBox="0 0 20 20"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
					clip-rule="evenodd"
				></path>
			</svg>
		</div>
		<input
			bind:this={searchInput}
			id="search-input"
			type="text"
			placeholder="Search constituency..."
			bind:value={searchTerm}
			on:focus={handleFocus}
			on:blur={handleBlur}
			on:keydown={handleKeydown}
			class="block w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm placeholder-gray-400 transition duration-150 ease-in-out hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			aria-label="Search for a constituency"
			autocomplete="off"
			role="combobox"
			aria-haspopup="listbox"
			aria-expanded={showSearchResults}
			aria-controls="search-results-listbox"
			aria-activedescendant={activeIndex >= 0
				? `search-result-${activeIndex}`
				: undefined}
		/>
	</div>

	<!-- Search Results -->
	{#if showSearchResults}
		<ul
			id="search-results-listbox"
			role="listbox"
			aria-labelledby="search-input"
			class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg"
		>
			{#each searchResults as result, i (result.const_code)}
				<li
					id={`search-result-${i}`}
					role="option"
					aria-selected={i === activeIndex}
					class="search-result-item cursor-pointer select-none px-3 py-2 text-gray-700 {i ===
					activeIndex
						? 'bg-blue-50 text-blue-700'
						: 'hover:bg-gray-100'}"
					on:click={() => selectConstituency(result)}
					on:mousedown|preventDefault
				>
					{result.constituency_name}
				</li>
			{:else}
				<!-- This block runs if searchResults is empty -->
				{#if searchTerm}
					<!-- Only show 'No results' if a search term exists -->
					<li class="px-3 py-2 text-xs italic text-gray-500">
						No results found.
					</li>
				{/if}
			{/each}
		</ul>
	{/if}
</div>
