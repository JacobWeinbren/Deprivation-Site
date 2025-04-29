<script lang="ts">
	export let error: string | null = null;
	export let loading: boolean = false;
</script>

{#if error}
	<div
		class="mx-auto flex max-w-3xl items-start space-x-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm"
		role="alert"
	>
		<svg
			class="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500"
			fill="currentColor"
			viewBox="0 0 20 20"
		>
			<path
				fill-rule="evenodd"
				d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-4.75a.75.75 0 001.5 0v-6a.75.75 0 00-1.5 0v6zm.75-9a1 1 0 100 2 1 1 0 000-2z"
				clip-rule="evenodd"
			></path>
		</svg>
		<div>
			<strong class="font-medium">Error Loading Data:</strong>
			<span class="mt-0.5 block">{error}</span>
		</div>
	</div>
{:else if loading}
	<div
		class="mx-auto flex max-w-3xl items-center space-x-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 shadow-sm"
		role="status"
	>
		<svg
			class="h-5 w-5 flex-shrink-0 animate-spin text-blue-600"
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
