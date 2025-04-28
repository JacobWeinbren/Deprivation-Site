<!-- src/lib/components/scatter/ConstituencyScatter.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import {
		parties,
		metrics, // Import the reordered metrics array
		partyColors,
		type ConstituencyData,
		type MetricOption, // Import MetricOption type if needed for explicit typing below
	} from "./chartConfig";
	import { getNumericValue, debounce } from "./utils";

	// Props
	export let data: ConstituencyData[] = [];

	// State
	let chartElement: HTMLDivElement;
	let placeholderElement: HTMLDivElement;
	let statsElement: HTMLDivElement;
	let selectedParty: string = "lab_voteshare";
	let selectedMetric: string = "overall_local_score";
	let isLoading: boolean = true;
	let errorMessage: string | null = null;
	let statsText: string = "Select variables to view correlation.";
	let isMounted: boolean = false;
	let Plotly: any = null;
	let ss: any = null;
	let resizeObserver: ResizeObserver | null = null;

	// --- MODIFIED: Create grouped metrics respecting the order in the metrics array ---
	let orderedGroupedMetrics: {
		groupName: string;
		options: { value: string; label: string }[];
	}[] = [];
	$: {
		const groupMap = new Map<string, { value: string; label: string }[]>();
		const groupOrder: string[] = []; // Keep track of group order as encountered

		metrics.forEach((metric) => {
			const group = metric.group || "Other";
			if (!groupMap.has(group)) {
				groupMap.set(group, []);
				groupOrder.push(group); // Add group to order list when first seen
			}
			groupMap
				.get(group)
				?.push({ value: metric.value, label: metric.label });
		});

		// Build the final array based on the encountered order
		orderedGroupedMetrics = groupOrder.map((groupName) => ({
			groupName,
			options: groupMap.get(groupName) || [],
		}));
	}

	// --- Core Plotting Logic ---
	async function updateChart() {
		if (
			!isMounted ||
			!Plotly ||
			!ss ||
			!chartElement ||
			!placeholderElement ||
			!statsElement
		) {
			isLoading = false;
			return;
		}

		isLoading = true;
		errorMessage = null;
		placeholderElement.innerHTML = `
            <div class="flex flex-col items-center justify-center text-center">
                <svg class="animate-spin h-7 w-7 text-indigo-600 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Calculating...
            </div>`;
		chartElement.style.visibility = "hidden";
		placeholderElement.style.display = "flex";

		await new Promise(requestAnimationFrame); // Allow UI to update

		const currentParty = selectedParty;
		const currentMetric = selectedMetric;
		const selectedPartyLabel =
			parties.find((p) => p.value === currentParty)?.label ||
			currentParty;
		const selectedMetricLabel =
			metrics.find((m) => m.value === currentMetric)?.label ||
			currentMetric;
		const color = partyColors[currentParty] || "#6B7280";

		// 1. Prepare data (using imported getNumericValue)
		const plotPoints: { x: number; y: number; text: string }[] = [];
		const statPoints: [number, number][] = [];
		for (const row of data) {
			const xVal = getNumericValue(row, currentMetric);
			const yVal = getNumericValue(row, currentParty);
			const name = row.constituency_name;

			// Filter out points where EITHER x OR y is 0 or null/invalid
			if (
				xVal !== null &&
				yVal !== null &&
				xVal > 0 && // Check if x-value is greater than 0
				yVal > 0 && // Check if y-value is greater than 0
				name
			) {
				plotPoints.push({ x: xVal, y: yVal, text: name });
				statPoints.push([xVal, yVal]);
			} else if (xVal !== null && yVal !== null && yVal < 0 && name) {
				console.warn(
					`Warning: Negative voteshare (${yVal}%) found for ${name}. Excluding from plot.`
				);
			}
		}

		try {
			await Plotly.purge(chartElement);
		} catch (e) {
			/* ignore purge errors */
		}

		if (statPoints.length < 2) {
			errorMessage = `Not enough valid data points (${statPoints.length}) with >0% voteshare AND >0 metric value to calculate correlation/regression. Try different variables.`;
			statsText = "";
			placeholderElement.textContent = errorMessage;
			isLoading = false;
			return;
		}

		// 2. Perform Calculations
		let regressionLine: { x: number[]; y: number[] } | null = null;
		let pearsonR: number = NaN;
		let rSquared: number = NaN;
		const n = statPoints.length;

		try {
			const xValues = statPoints.map((p) => p[0]);
			const yValues = statPoints.map((p) => p[1]);

			const regression = ss.linearRegression(statPoints);
			if (isNaN(regression.m) || isNaN(regression.b))
				throw new Error("Regression calculation resulted in NaN.");
			const regressionFunction = ss.linearRegressionLine(regression);

			pearsonR = ss.sampleCorrelation(xValues, yValues);
			if (isNaN(pearsonR))
				throw new Error("Correlation calculation resulted in NaN.");
			rSquared = pearsonR * pearsonR;

			const xMin = ss.min(xValues);
			const xMax = ss.max(xValues);
			const xRange = xMax - xMin;
			const extendedXMin = xMin - xRange * 0.02;
			const extendedXMax = xMax + xRange * 0.02;

			// Clamp regression line start/end points at y=0 and x=0
			const finalXMin = Math.max(0, extendedXMin);
			const finalXMax = extendedXMax;
			const finalYMin = Math.max(0, regressionFunction(finalXMin));
			const finalYMax = Math.max(0, regressionFunction(finalXMax));

			regressionLine = {
				x: [finalXMin, finalXMax],
				y: [finalYMin, finalYMax],
			};
		} catch (e: any) {
			console.error("Stat calculation error:", e);
			errorMessage = `Statistical calculation error: ${e.message}`;
			statsText = "";
			placeholderElement.textContent = errorMessage;
			isLoading = false;
			return;
		}

		// 3. Prepare Plotly Traces
		const traces = [];
		traces.push({
			x: plotPoints.map((p) => p.x),
			y: plotPoints.map((p) => p.y),
			text: plotPoints.map((p) => p.text),
			mode: "markers",
			type: "scatter",
			name: "Constituencies",
			marker: {
				color: color,
				size: 7,
				opacity: 0.65,
				line: { color: "rgba(0,0,0,0.25)", width: 0.5 },
			},
			hoverinfo: "text",
			hovertemplate:
				`<b>%{text}</b><br>` +
				`${selectedMetricLabel}: %{x:,.2f}<br>` +
				`${selectedPartyLabel}: %{y:.2f}` +
				`<extra></extra>`,
		});
		if (regressionLine) {
			traces.push({
				x: regressionLine.x,
				y: regressionLine.y,
				mode: "lines",
				type: "scatter",
				name: "Line of Best Fit",
				line: { color: "rgba(0, 0, 0, 0.65)", width: 1.5 },
				hoverinfo: "skip",
			});
		}

		// 4. Define Plotly Layout
		const commonFontFamily =
			'"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
		let xAxisTickFormat = ".0f"; // Default
		if (
			selectedMetric.includes("price") ||
			selectedMetric.includes("income")
		) {
			xAxisTickFormat = ",.0f";
		} else if (
			selectedMetric.includes("percentage") ||
			selectedMetric.includes("prop") ||
			selectedMetric.includes("share") ||
			selectedMetric.includes("census_")
		) {
			xAxisTickFormat = ".1f";
		} else if (selectedMetric.includes("score")) {
			xAxisTickFormat = ".1f";
		} else if (selectedMetric.includes("residents_per_household")) {
			xAxisTickFormat = ".1f";
		}
		if (selectedMetric === "overall_local_score") xAxisTickFormat = ".1f";
		if (selectedMetric === "residents_per_household")
			xAxisTickFormat = ".2f";

		const layout = {
			font: {
				family: commonFontFamily,
				size: 12,
				color: "#374151",
			},
			title: {
				text: `<b>${selectedPartyLabel} vs ${selectedMetricLabel}</b><br><span style="font-size: 0.8em; color: #6b7280;">British Constituencies (2024 Election) | Pearson r: ${pearsonR.toFixed(3)}, R²: ${rSquared.toFixed(3)}</span>`,
				xref: "paper",
				x: 0.01,
				yref: "paper",
				y: 0.98,
				align: "left",
				showarrow: false,
				font: { size: 17, color: "#1f2937" },
			},
			xaxis: {
				title: {
					text: selectedMetricLabel,
					font: { size: 13, color: "#4b5563" },
					standoff: 15,
				},
				automargin: true,
				gridcolor: "#e5e7eb",
				zeroline: false,
				rangemode: "tozero",
				tickfont: { size: 11, color: "#6b7280" },
				tickformat: xAxisTickFormat,
				showline: true,
				linecolor: "#d1d5db",
				linewidth: 1,
			},
			yaxis: {
				title: {
					text: selectedPartyLabel,
					font: { size: 13, color: "#4b5563" },
					standoff: 15,
				},
				automargin: true,
				gridcolor: "#e5e7eb",
				zeroline: true,
				zerolinecolor: "#d1d5db",
				zerolinewidth: 1,
				ticksuffix: "%",
				rangemode: "tozero",
				tickfont: { size: 11, color: "#6b7280" },
				showline: true,
				linecolor: "#d1d5db",
				linewidth: 1,
			},
			hovermode: "closest",
			margin: { l: 65, r: 25, t: 70, b: 55 },
			showlegend: true,
			legend: {
				x: 0.5,
				xanchor: "center",
				y: -0.15,
				orientation: "h",
				bgcolor: "rgba(255,255,255,0)",
				bordercolor: "rgba(0,0,0,0)",
				traceorder: "normal",
				font: { size: 11, color: "#4b5563" },
			},
			autosize: true,
			plot_bgcolor: "#ffffff",
			paper_bgcolor: "#ffffff",
			hoverlabel: {
				bgcolor: "#ffffff",
				bordercolor: "#d1d5db",
				font: { size: 12, color: "#1f2937", family: commonFontFamily },
				align: "left",
				namelength: -1,
			},
		};

		// 5. Render Chart
		try {
			await Plotly.newPlot(chartElement, traces, layout, {
				responsive: true,
				displaylogo: false,
				modeBarButtonsToRemove: [
					"select2d",
					"lasso2d",
					"sendDataToCloud",
					"editInChartStudio",
					"plotly_direct",
					"resetViews",
					"toggleSpikelines",
					"hoverCompareCartesian",
					"hoverClosestCartesian",
				],
			});
			placeholderElement.style.display = "none";
			chartElement.style.visibility = "visible";
			statsText = `Pearson Correlation (r): <b class="font-semibold text-gray-800">${pearsonR.toFixed(3)}</b> &nbsp;|&nbsp; R-squared (R²): <b class="font-semibold text-gray-800">${rSquared.toFixed(3)}</b> &nbsp;|&nbsp; N (Constituencies with >0% voteshare & >0 metric value): <b class="font-semibold text-gray-800">${n}</b>`;
		} catch (e: any) {
			console.error("Plotly rendering error:", e);
			errorMessage = `Plotly rendering error: ${e.message}`;
			statsText = "";
			placeholderElement.textContent = errorMessage;
			placeholderElement.style.display = "flex";
			chartElement.style.visibility = "hidden";
		} finally {
			isLoading = false;
		}
	}

	onMount(async () => {
		isLoading = true;
		placeholderElement.innerHTML = `
             <div class="flex flex-col items-center justify-center text-center">
                 <svg class="animate-spin h-7 w-7 text-indigo-600 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                     <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                     <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
                 Loading libraries...
             </div>`;
		placeholderElement.style.display = "flex";

		try {
			// Dynamically import large libraries
			const [plotlyModule, ssModule] = await Promise.all([
				import("plotly.js-dist-min"),
				import("simple-statistics"),
			]);
			Plotly = plotlyModule.default || plotlyModule;
			ss = ssModule;

			if (
				typeof Plotly?.newPlot !== "function" ||
				typeof ss?.linearRegression !== "function" ||
				typeof ss?.sampleCorrelation !== "function"
			) {
				throw new Error(
					"Plotly or simple-statistics failed to load correctly."
				);
			}

			isMounted = true;
			console.log("Plotly and simple-statistics loaded successfully.");
			await updateChart(); // Initial chart draw

			// Use imported debounce
			const debouncedResize = debounce(() => {
				if (Plotly && chartElement && chartElement.offsetParent) {
					Plotly.Plots.resize(chartElement);
				}
			}, 150);

			resizeObserver = new ResizeObserver(debouncedResize);
			if (chartElement?.parentElement) {
				resizeObserver.observe(chartElement.parentElement);
			}
		} catch (err: any) {
			console.error("Failed to load libraries or initialize chart:", err);
			errorMessage = `Initialization Error: ${err.message}. Please refresh the page.`;
			placeholderElement.textContent = errorMessage;
			isLoading = false;
			isMounted = false;
		}
	});

	onDestroy(() => {
		if (resizeObserver) {
			resizeObserver.disconnect();
		}
		if (Plotly && chartElement) {
			try {
				Plotly.purge(chartElement);
				console.log("Plotly chart purged.");
			} catch (e) {
				console.warn("Error purging Plotly chart:", e);
			}
		}
		isMounted = false;
		console.log("ConstituencyScatter component destroyed.");
	});

	// Reactive statement to update chart when selections change
	$: if (isMounted && (selectedParty || selectedMetric)) {
		// Use imported debounce
		const debouncedUpdate = debounce(updateChart, 50);
		debouncedUpdate();
	}
</script>

<!-- Template -->
<div
	class="p-5 sm:p-6 md:p-8 max-w-5xl mx-auto font-sans bg-white bg-opacity-75 backdrop-blur-sm shadow-xl rounded-xl border border-gray-200/80"
>
	<!-- Dropdowns -->
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-6 md:mb-8">
		<div>
			<label
				for="party-select-{Math.random().toString(36).substring(2)}"
				class="block text-sm font-medium text-gray-700 mb-1.5"
			>
				Party Voteshare:
			</label>
			<select
				id="party-select-{Math.random().toString(36).substring(2)}"
				bind:value={selectedParty}
				class="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-400"
				disabled={isLoading}
			>
				{#each parties as party (party.value)}
					<option value={party.value}>{party.label}</option>
				{/each}
			</select>
		</div>
		<div>
			<label
				for="metric-select-{Math.random().toString(36).substring(2)}"
				class="block text-sm font-medium text-gray-700 mb-1.5"
			>
				Metric:
			</label>
			<select
				id="metric-select-{Math.random().toString(36).substring(2)}"
				bind:value={selectedMetric}
				class="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-400"
				disabled={isLoading}
			>
				<!-- --- MODIFIED: Iterate over orderedGroupedMetrics --- -->
				{#each orderedGroupedMetrics as groupInfo (groupInfo.groupName)}
					<optgroup label={groupInfo.groupName}>
						{#each groupInfo.options as metric (metric.value)}
							<option value={metric.value}>{metric.label}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
		</div>
	</div>

	<!-- Chart Area -->
	<div class="relative w-full min-h-[450px] md:min-h-[600px]">
		<!-- Chart Div -->
		<div
			bind:this={chartElement}
			class="w-full h-[450px] md:h-[600px]"
			style:visibility={isLoading || errorMessage ? "hidden" : "visible"}
		/>
		<!-- Placeholder -->
		<div
			bind:this={placeholderElement}
			class="absolute inset-0 flex items-center justify-center text-center text-gray-500 text-base p-4 bg-white/80 backdrop-blur-sm rounded-lg"
			style:display={isLoading || errorMessage ? "flex" : "none"}
			class:text-red-600={errorMessage}
		/>
	</div>

	<!-- Stats Display Area -->
	<div
		bind:this={statsElement}
		class="mt-8 pt-4 text-sm text-gray-600 text-center min-h-[1.5em] border-t border-gray-200/80"
	>
		{@html statsText || "&nbsp;"}
	</div>

	<!-- Notes Section -->
	<div
		class="mt-6 pt-4 border-t border-gray-200/80 text-xs text-gray-500 italic space-y-2"
	>
		<p>
			<strong>Note on SEISA (2021):</strong> This socio-economic index combines
			factors like qualifications, occupation, housing tenure (renting), health,
			lone parenthood, age demographics, migration, and household income.
		</p>
		<p>
			<strong>Note on IMD (Index of Multiple Deprivation):</strong> This index
			measures deprivation across domains including Income, Employment, Education,
			Health, Crime, Housing/Services Barriers, and Living Environment. Components
			may vary slightly by UK nation.
		</p>
	</div>

	<!-- Data Sources Section -->
	<div
		class="mt-6 pt-4 border-t border-gray-200/80 text-xs text-gray-600 space-y-3"
	>
		<h4 class="font-semibold text-sm text-gray-700 mb-2">Data Sources</h4>
		<p class="italic text-gray-500 text-[0.7rem] -mt-1 mb-2">
			Note: Data from sources below is often aggregated from smaller
			geographic areas (LSOA, Datazone, OA) to the constituency level.
		</p>
		<ul class="list-disc list-outside pl-4 space-y-1.5">
			<!-- ... (list of sources remains the same) ... -->
			<li>
				<strong>Election Results (2024):</strong> House of Commons
				Library -
				<a
					href="https://commonslibrary.parliament.uk/research-briefings/cbp-10009/"
					target="_blank"
					rel="noopener noreferrer"
					class="text-indigo-600 hover:text-indigo-800 hover:underline"
					>Briefing CBP-10009</a
				>
			</li>
			<li>
				<strong>Census Data Summaries (2021/22):</strong> R.
				Scott/Github -
				<a
					href="https://github.com/ralphascott/UKGE24_wpc_census_summaries"
					target="_blank"
					rel="noopener noreferrer"
					class="text-indigo-600 hover:text-indigo-800 hover:underline"
					>UKGE24 WPC Census Summaries</a
				>
			</li>
			<li>
				<strong>Deprivation (IMD GB 2020):</strong> MySociety -
				<a
					href="https://pages.mysociety.org/composite_uk_imd/datasets/gb_index/latest"
					target="_blank"
					rel="noopener noreferrer"
					class="text-indigo-600 hover:text-indigo-800 hover:underline"
					>Composite UK IMD</a
				>
			</li>
			<li>
				<strong>Deprivation (SEISA UK 2021):</strong> HESA -
				<a
					href="https://www.hesa.ac.uk/data-and-analysis/research/seisa/resources"
					target="_blank"
					rel="noopener noreferrer"
					class="text-indigo-600 hover:text-indigo-800 hover:underline"
					>SEISA Resources</a
				>
			</li>
			<li>
				<strong>Median House Prices (E&W):</strong> ONS -
				<a
					href="https://www.ons.gov.uk/peoplepopulationandcommunity/housing/datasets/medianpricepaidbylowerlayersuperoutputareahpssadataset46"
					target="_blank"
					rel="noopener noreferrer"
					class="text-indigo-600 hover:text-indigo-800 hover:underline"
					>HPSSA Dataset 46</a
				>
			</li>
			<li>
				<strong>Child Poverty (Constituency 2022/23):</strong> End Child
				Poverty Coalition -
				<a
					href="https://endchildpoverty.org.uk/child-poverty-2024/"
					target="_blank"
					rel="noopener noreferrer"
					class="text-indigo-600 hover:text-indigo-800 hover:underline"
					>Local Child Poverty Statistics 2024</a
				>
			</li>
			<li>
				<strong>Population Estimates (LSOA Mid-Year):</strong> ONS -
				<a
					href="http://ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/datasets/lowersuperoutputareamidyearpopulationestimates"
					target="_blank"
					rel="noopener noreferrer"
					class="text-indigo-600 hover:text-indigo-800 hover:underline"
					>LSOA Mid-Year Estimates</a
				>
			</li>
		</ul>
	</div>
</div>
