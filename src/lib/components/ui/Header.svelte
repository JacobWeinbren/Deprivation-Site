<script lang="ts">
	export let title = "British Constituency Explorer";
	export let description =
		"Compare 2024 General Election results with socio-economic data. Select a party/swing and a metric below, then explore the scatter plot or compare maps. Click a point or area to highlight and zoom.";
</script>

<div class="mb-8 text-center sm:mb-10">
	<h1
		class="mb-3 text-2xl font-semibold tracking-tight text-gray-800 sm:mb-4 sm:text-3xl"
	>
		{title}
	</h1>
	<p
		class="mx-auto max-w-3xl text-sm leading-relaxed text-gray-600 sm:text-base"
	>
		{description}
	</p>
</div>
