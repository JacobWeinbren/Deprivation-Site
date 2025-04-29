<script lang="ts">
	export let isLoading: boolean = false;
	export let errorMessage: string | null = null;
	export let initialLoad: boolean = false; // Add prop to differentiate initial load
</script>

<div
	class="absolute inset-0 flex items-center justify-center text-center p-4 bg-gray-50/90 z-10 transition-opacity duration-150"
>
	{#if errorMessage}
		<div class="flex flex-col items-center text-red-700">
			<svg
				class="w-8 h-8 mb-2 text-red-400"
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
			<p class="text-sm font-medium">Chart Error</p>
			<p class="text-xs mt-1 max-w-xs">{errorMessage}</p>
		</div>
	{:else if isLoading}
		<div class="flex flex-col items-center justify-center text-gray-600">
			<svg
				class="animate-spin h-6 w-6 text-blue-600 mb-3"
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
			<p class="text-xs font-medium">
				{initialLoad ? "Loading Chart..." : "Updating Chart..."}
			</p>
		</div>
	{/if}
</div>
