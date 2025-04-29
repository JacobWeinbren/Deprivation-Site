<script lang="ts">
	import { createEventDispatcher } from "svelte";

	export let errorMessage: string | null = null;
	export let isLoading: boolean = false;

	const dispatch = createEventDispatcher<{ retry: void }>();

	function dispatchRetry() {
		// Dispatch event for parent component (ConstituencyCompareMap)
		dispatch("retry");
		// Also dispatch global event if needed elsewhere (optional)
		// window.dispatchEvent(new CustomEvent('retry'));
	}
</script>

{#if errorMessage}
	<div
		class="absolute inset-0 z-30 flex items-center justify-center rounded-lg bg-red-50/90 p-6 text-center text-red-800 backdrop-blur-sm"
		role="alert"
	>
		<div class="flex flex-col items-center">
			<svg
				class="mb-3 h-10 w-10 text-red-400"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
				/>
			</svg>
			<span class="text-sm font-medium">Map Error</span>
			<p class="mt-1 max-w-sm text-xs">{errorMessage}</p>
			<button
				class="mt-4 rounded-md bg-red-100 px-4 py-1.5 text-xs font-medium text-red-800 transition duration-150 ease-in-out hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
				on:click={dispatchRetry}
			>
				Retry
			</button>
		</div>
	</div>
{:else if isLoading}
	<div
		class="absolute inset-0 z-30 flex items-center justify-center rounded-lg bg-gray-100/80 p-6 text-center text-gray-600 backdrop-blur-sm"
		role="status"
	>
		<div class="flex flex-col items-center justify-center">
			<svg
				class="mb-3 h-7 w-7 animate-spin text-blue-600"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<circle
					class="opacity-25"
					cx="12"
					cy="12"
					r="10"
					stroke="currentColor"
					stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
			<p class="text-sm font-medium">Loading Map...</p>
		</div>
	</div>
{/if}
