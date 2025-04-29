<script lang="ts">
	export let pearsonR: number | null = null;
	export let rSquared: number | null = null;
	export let n: number = 0;
	export let isLoading: boolean = false;

	function getCorrelationStrength(r: number | null): string {
		if (r === null || isNaN(r)) return "text-gray-600"; // Handle NaN
		const absR = Math.abs(r);
		if (absR >= 0.7) return "text-emerald-700"; // Strong
		if (absR >= 0.4) return "text-sky-700"; // Moderate
		if (absR >= 0.1) return "text-amber-700"; // Weak
		return "text-gray-600"; // Very Weak / None
	}

	function getRSquaredStrength(r2: number | null): string {
		if (r2 === null || isNaN(r2)) return "text-gray-600"; // Handle NaN
		if (r2 >= 0.5) return "text-emerald-700"; // Strong
		if (r2 >= 0.16) return "text-sky-700"; // Moderate
		if (r2 >= 0.01) return "text-amber-700"; // Weak
		return "text-gray-600"; // Very Weak / None
	}
</script>

<div
	class="text-center text-xs px-2 min-h-[20px] flex items-center justify-center"
>
	{#if isLoading}
		<span class="text-gray-500 italic">Calculating statistics...</span>
	{:else if pearsonR !== null && !isNaN(pearsonR) && rSquared !== null && !isNaN(rSquared)}
		<div class="flex items-center space-x-3 text-gray-600">
			<span>
				Correlation (r):
				<span class="font-medium {getCorrelationStrength(pearsonR)}">
					{pearsonR.toFixed(2)}
				</span>
			</span>
			<span class="text-gray-300">|</span>
			<span>
				R²:
				<span class="font-medium {getRSquaredStrength(rSquared)}">
					{rSquared.toFixed(2)}
				</span>
			</span>
			<span class="text-gray-300">|</span>
			<span
				>N: <span class="font-medium text-gray-700"
					>{n.toLocaleString()}</span
				></span
			>
		</div>
	{:else if n > 0 && n < 5}
		<span class="text-gray-500 italic">
			N={n.toLocaleString()} (Insufficient data for correlation)
		</span>
	{:else if n === 0}
		<span class="text-gray-500 italic">No valid data points found</span>
	{:else}
		<span class="text-gray-500 italic">Correlation not calculated</span>
	{/if}
</div>
