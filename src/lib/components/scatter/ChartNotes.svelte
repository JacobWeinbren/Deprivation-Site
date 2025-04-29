<script lang="ts">
	export let compact: boolean = false;
	export let notes: string =
		"IMD = Index of Multiple Deprivation (2019/20). SEISA = Skills and Employment (2021). Click points to highlight.";
</script>

{#if !compact}
	<div
		class="mt-3 pt-3 border-t border-gray-200/75 text-[11px] text-gray-500 space-y-1"
	>
		<p>
			<span class="font-medium text-gray-600">Notes:</span>
			{notes}
		</p>
	</div>
{/if}
