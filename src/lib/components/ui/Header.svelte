<script lang="ts">
	export let title = "British Constituency Explorer";
	export let description =
		"Compare 2024 General Election results with socio-economic data. Select a party and metric below, then explore the scatter plot or compare maps. Click a point or area to highlight and zoom.";
</script>

<div class="mb-8 sm:mb-10 text-center">
	<h1
		class="text-2xl sm:text-3xl font-semibold text-gray-800 mb-3 sm:mb-4 tracking-tight"
	>
		{title}
	</h1>
	<p
		class="text-sm sm:text-base text-gray-600 max-w-3xl mx-auto leading-relaxed"
	>
		{description}
	</p>
</div>
