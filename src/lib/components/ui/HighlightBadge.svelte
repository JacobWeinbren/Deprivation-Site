<script lang="ts">
	import { createEventDispatcher } from "svelte";

	export let highlightedConstituency: string | null = null;

	const dispatch = createEventDispatcher<{ reset: void }>();
</script>

{#if highlightedConstituency}
	<div class="mt-4 flex justify-center border-t border-gray-200/75 pt-4">
		<button
			on:click={() => dispatch("reset")}
			class="flex items-center rounded-full bg-blue-100 py-1 pl-3 pr-2 text-xs font-medium text-blue-700 transition duration-150 ease-in-out hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
			aria-label="Clear constituency highlight: {highlightedConstituency}"
			title="Clear highlight"
		>
			<span class="mr-1.5">{highlightedConstituency}</span>
			<svg
				class="h-3.5 w-3.5 text-blue-600"
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
