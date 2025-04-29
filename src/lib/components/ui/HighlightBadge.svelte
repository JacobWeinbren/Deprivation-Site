<script lang="ts">
	import { createEventDispatcher } from "svelte";

	export let highlightedConstituency: string | null = null;

	const dispatch = createEventDispatcher<{
		reset: void;
	}>();

	function resetView() {
		dispatch("reset");
	}
</script>

{#if highlightedConstituency}
	<div class="flex justify-center mt-4 pt-4 border-t border-gray-200/75">
		<button
			on:click={resetView}
			class="flex items-center py-1 px-3 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-full transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400"
			aria-label="Clear constituency highlight: {highlightedConstituency}"
			title="Clear highlight"
		>
			<span class="mr-1.5">{highlightedConstituency}</span>
			<svg
				class="w-3.5 h-3.5 text-blue-600 hover:text-blue-800"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				stroke-width="2.5"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M6 18L18 6M6 6l12 12"
				></path>
			</svg>
		</button>
	</div>
{/if}
