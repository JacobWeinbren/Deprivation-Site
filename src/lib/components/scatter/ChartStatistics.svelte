<script lang="ts">
	export let pearsonR: number | null = null;
	export let rSquared: number | null = null;
	export let n: number = 0;
	export let isLoading: boolean = false;

	// Determine color based on correlation strength
	function getCorrelationStrengthClass(r: number | null): string {
		if (r === null || isNaN(r)) return "text-gray-600";
		const absR = Math.abs(r);
		if (absR >= 0.7) return "text-emerald-700"; // Strong
		if (absR >= 0.4) return "text-sky-700"; // Moderate
		if (absR >= 0.1) return "text-amber-700"; // Weak
		return "text-gray-600"; // Very Weak / None
	}

	// Determine color based on R-squared strength
	function getRSquaredStrengthClass(r2: number | null): string {
		if (r2 === null || isNaN(r2)) return "text-gray-600";
		if (r2 >= 0.5) return "text-emerald-700"; // Strong explanation
		if (r2 >= 0.16) return "text-sky-700"; // Moderate explanation
		if (r2 >= 0.01) return "text-amber-700"; // Weak explanation
		return "text-gray-600"; // Very Weak / None
	}
</script>

<div
	class="flex min-h-[20px] items-center justify-center px-2 text-center text-xs"
>
	{#if isLoading}
		<span class="italic text-gray-500">Calculating statistics...</span>
	{:else if n === 0}
		<span class="italic text-gray-500">No valid data points found</span>
	{:else if n < 5}
		<span class="italic text-gray-500">
			N={n.toLocaleString()} (Insufficient data for correlation)
		</span>
	{:else if pearsonR !== null && !isNaN(pearsonR) && rSquared !== null && !isNaN(rSquared)}
		<div
			class="flex flex-wrap items-center justify-center gap-x-3 text-gray-600"
		>
			<span>
				Correlation (r):
				<span
					class="font-medium {getCorrelationStrengthClass(pearsonR)}"
				>
					{pearsonR.toFixed(2)}
				</span>
			</span>
			<span class="hidden text-gray-300 sm:inline">|</span>
			<span>
				R²:
				<span class="font-medium {getRSquaredStrengthClass(rSquared)}">
					{rSquared.toFixed(2)}
				</span>
			</span>
			<span class="hidden text-gray-300 sm:inline">|</span>
			<span
				>N: <span class="font-medium text-gray-700"
					>{n.toLocaleString()}</span
				></span
			>
		</div>
	{:else}
		<span class="italic text-gray-500">Correlation not calculated</span>
	{/if}
</div>
