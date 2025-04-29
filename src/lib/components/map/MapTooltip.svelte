<script lang="ts">
	export let visible: boolean = false;
	export let content: string = "";
	export let position = { x: 0, y: 0 };
</script>

{#if visible}
	<div
		class="custom-popup absolute pointer-events-none z-[1000] transition-opacity duration-100"
		style="left: {position.x}px; top: {position.y}px;"
	>
		<div class="custom-popup-content">
			{@html content}
		</div>
	</div>
{/if}

<style>
	.custom-popup {
		transform: translate(-50%, -100%);
		margin-top: -8px; /* Increased offset */
		opacity: 0; /* Start hidden */
		animation: fadeIn 100ms ease-out forwards;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translate(-50%, -95%); /* Start slightly lower */
		}
		to {
			opacity: 1;
			transform: translate(-50%, -100%);
		}
	}

	.custom-popup-content {
		background-color: rgba(0, 0, 0, 0.85); /* Darker background */
		color: #ffffff; /* White text */
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		padding: 6px 10px; /* Slightly adjusted padding */
		font-size: 12px;
		line-height: 1.4;
		max-width: 240px;
		border: none; /* Removed border */
		position: relative;
		white-space: normal; /* Allow wrapping */
	}

	/* Tooltip arrow */
	.custom-popup-content::after {
		content: "";
		position: absolute;
		bottom: -5px;
		left: 50%;
		transform: translateX(-50%);
		width: 0;
		height: 0;
		border-left: 6px solid transparent;
		border-right: 6px solid transparent;
		border-top: 6px solid rgba(0, 0, 0, 0.85); /* Match background */
	}

	/* Ensure global styles for tooltip content are applied if needed */
	:global(.custom-map-tooltip strong) {
		display: block;
		font-weight: 600;
		margin-bottom: 2px;
		font-size: 12px;
		color: #fff; /* Ensure white */
	}
	:global(.custom-map-tooltip span) {
		display: block;
		color: #e5e7eb; /* Lighter gray for value */
		font-size: 11px;
	}
</style>
