<script lang="ts">
	export let errorMessage: string | null = null;
	export let isLoading: boolean = false;

	function dispatchRetry() {
		// Dispatch a custom event that the parent can listen for
		const event = new CustomEvent("retry");
		window.dispatchEvent(event); // Use window or dispatch from parent
	}
</script>

{#if errorMessage}
	<div
		class="absolute inset-0 flex items-center justify-center bg-red-50/90 text-red-800 p-6 z-30 rounded-lg text-center backdrop-blur-sm"
	>
		<div class="flex flex-col items-center">
			<svg
				class="w-10 h-10 mb-3 text-red-400"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				stroke-width="1.5"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
				/>
			</svg>
			<span class="font-medium text-sm">Map Error</span>
			<p class="text-xs mt-1 max-w-sm">{errorMessage}</p>
			<button
				class="mt-4 px-4 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-medium rounded-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-400"
				on:click={dispatchRetry}
			>
				Retry
			</button>
		</div>
	</div>
{:else if isLoading}
	<div
		class="absolute inset-0 flex items-center justify-center bg-gray-100/80 text-gray-600 p-6 z-30 rounded-lg backdrop-blur-sm"
	>
		<div class="flex flex-col items-center justify-center text-center">
			<svg
				class="animate-spin h-7 w-7 text-blue-600 mb-3"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
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
