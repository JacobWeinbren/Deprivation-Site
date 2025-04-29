<script lang="ts">
	export let error: string | null = null;
	export let loading: boolean = false;
</script>

{#if error}
	<div
		class="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-lg max-w-3xl mx-auto text-sm flex items-start space-x-3 shadow-sm"
		role="alert"
	>
		<svg
			class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
			fill="currentColor"
			viewBox="0 0 20 20"
		>
			<path
				fill-rule="evenodd"
				d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-10a1 1 0 10-2 0v4a1 1 0 102 0v-4zm-1-4a1 1 0 011 1v.01a1 1 0 11-2 0V5a1 1 0 011-1z"
				clip-rule="evenodd"
			></path>
		</svg>
		<div>
			<strong class="font-medium">Error Loading Data:</strong>
			<span class="block mt-0.5">{error}</span>
		</div>
	</div>
{:else if loading}
	<div
		class="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg max-w-3xl mx-auto text-sm flex items-center space-x-3 shadow-sm"
		role="status"
	>
		<svg
			class="animate-spin h-5 w-5 text-blue-600 flex-shrink-0"
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
		<span class="font-medium">Loading Data... Please wait.</span>
	</div>
{/if}
