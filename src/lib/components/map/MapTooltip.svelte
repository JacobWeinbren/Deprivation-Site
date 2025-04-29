<script lang="ts">
	export let visible: boolean = false;
	export let content: string = "";
	export let position = { x: 0, y: 0 };
</script>

{#if visible}
	<div
		class="pointer-events-none absolute z-[1000] transform transition-opacity duration-100"
		style="left: {position.x}px; top: {position.y}px; --tw-translate-x: -50%; --tw-translate-y: -100%; margin-top: -8px;"
		role="tooltip"
	>
		<!-- Use @html carefully - ensure content is sanitized or trusted -->
		<div
			class="rounded border border-gray-700/50 bg-gray-900/90 px-2.5 py-1.5 text-xs text-white shadow-lg backdrop-blur-sm"
		>
			{@html content}
		</div>
		<!-- Optional: Arrow -->
		<div
			class="absolute left-1/2 h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-gray-900/90"
			style="bottom: -5px;"
		></div>
	</div>
{/if}

<style>
	/* Fade-in animation (optional but nice) */
	div[role="tooltip"] {
		opacity: 0;
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
</style>
