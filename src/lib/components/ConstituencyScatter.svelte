<!-- src/lib/components/ConstituencyScatter.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { derived } from "svelte/store"; // Import derived if needed, or use reactive statement

	// Define the type directly here if not shared
	interface ConstituencyData {
		constituency_name: string;
		const_code: string;
		[key: string]: string | number | undefined | null;
	}

	// Props received from the parent (+page.svelte)
	export let data: ConstituencyData[] = [];

	// --- Component State ---
	let chartElement: HTMLDivElement;
	let placeholderElement: HTMLDivElement;
	let statsElement: HTMLDivElement;
	let selectedParty: string = "lab_voteshare"; // Default party
	let selectedMetric: string = "overall_local_score"; // Default metric
	let isLoading: boolean = true;
	let errorMessage: string | null = null;
	let statsText: string = "Select variables to view correlation.";
	let isMounted: boolean = false;

	let Plotly: any = null;
	let ss: any = null;

	// --- Configuration ---
	const parties = [
		{ value: "con_voteshare", label: "Conservative Voteshare (%)" },
		{ value: "lab_voteshare", label: "Labour Voteshare (%)" },
		{ value: "ld_voteshare", label: "Lib Dem Voteshare (%)" },
		{ value: "ref_voteshare", label: "Reform UK Voteshare (%)" },
		{ value: "green_voteshare", label: "Green Voteshare (%)" },
		{ value: "snp_voteshare", label: "SNP Voteshare (%)" }, // Added SNP
		{ value: "pc_voteshare", label: "Plaid Cymru Voteshare (%)" },
		{ value: "oth_voteshare", label: "Other Voteshare (%)" },
	];

	// --- MODIFICATION: Added group property and new census variables ---
	const metrics = [
		// Group: Deprivation (IMD/SEISA)
		{
			value: "overall_local_score",
			label: "Overall Deprivation Score (IMD)",
			group: "Deprivation (IMD/SEISA)",
		},
		{
			value: "income_score",
			label: "Income Deprivation Score (IMD)",
			group: "Deprivation (IMD/SEISA)",
		},
		{
			value: "employment_score",
			label: "Employment Deprivation Score (IMD)",
			group: "Deprivation (IMD/SEISA)",
		},
		{
			value: "seisa_2021_proportion",
			label: "SEISA Deprivation Proportion",
			group: "Deprivation (IMD/SEISA)",
		},
		// Group: Economic
		{
			value: "median_house_price_2023",
			label: "Median House Price 2023 (£)",
			group: "Economic",
		},
		{
			value: "annualincome", // Assuming this is the key for annual income
			label: "Median Annual Income (£)",
			group: "Economic",
		},
		{
			value: "child_poverty_percentage_22_23",
			label: "Child Poverty % (22/23)",
			group: "Economic",
		},
		// Group: Social/Demographic (Original)
		{
			value: "poorhealth",
			label: "Poor Health Proportion (%)",
			group: "Social/Demographic",
		},
		{
			value: "propqual",
			label: "Proportion Low Qualifications (%)",
			group: "Social/Demographic",
		},
		{
			value: "loneprop",
			label: "Proportion Lone Parent Households (%)",
			group: "Social/Demographic",
		},
		{
			value: "propocc",
			label: "Proportion NSSEC 3-8 (%)",
			group: "Social/Demographic",
		},
		{
			value: "youngpop",
			label: "Young Population Proportion (%)",
			group: "Social/Demographic",
		},
		{
			value: "oldpop",
			label: "Old Population Proportion (%)",
			group: "Social/Demographic",
		},
		{
			value: "migrantprop",
			label: "Migrant Population Proportion (%)",
			group: "Social/Demographic",
		},
		// Group: Housing (Original + Census)
		{
			value: "privaterent",
			label: "Proportion Renting (Private+Social) (%)",
			group: "Housing",
		},
		{
			value: "socialrent",
			label: "Proportion Social Housing (%)",
			group: "Housing",
		},
		{
			value: "census_HouseOwns",
			label: "Census: Home Ownership (%)",
			group: "Housing",
		},
		{
			value: "census_HousePrivateRent",
			label: "Census: Private Renting (%)",
			group: "Housing",
		},
		{
			value: "census_HouseSocialRent",
			label: "Census: Social Renting (%)",
			group: "Housing",
		},
		{
			value: "residents_per_household",
			label: "Census: Residents per Household",
			group: "Housing",
		},
		// Group: Census Demographics
		{
			value: "census_Age75plus",
			label: "Census: Population Aged 75+ (%)",
			group: "Census: Demographics",
		},
		// Group: Census Transport
		{
			value: "census_CarsNone",
			label: "Census: Households with No Car (%)",
			group: "Census: Transport",
		},
		{
			value: "census_CarsTwoPlus",
			label: "Census: Households with 2+ Cars (%)",
			group: "Census: Transport",
		},
		// Group: Census Birthplace
		{
			value: "census_BornEU",
			label: "Census: Born in EU (%)",
			group: "Census: Birthplace",
		},
		{
			value: "census_BornNonEU",
			label: "Census: Born Outside EU (%)",
			group: "Census: Birthplace",
		},
		// Group: Census Occupation/Activity
		{
			value: "census_RoutineSemiRoutine",
			label: "Census: Routine/Semi-Routine Occupations (%)",
			group: "Census: Occupation/Activity",
		},
		{
			value: "census_InactiveLongTermSick",
			label: "Census: Inactive (Long-Term Sick) (%)",
			group: "Census: Occupation/Activity",
		},
		// Group: Census Ethnicity
		{
			value: "census_EthnicityWhite",
			label: "Census: Ethnicity White (%)",
			group: "Census: Ethnicity",
		},
		{
			value: "census_EthnicityMixed",
			label: "Census: Ethnicity Mixed (%)",
			group: "Census: Ethnicity",
		},
		{
			value: "census_EthnicityAsian",
			label: "Census: Ethnicity Asian (%)",
			group: "Census: Ethnicity",
		},
		{
			value: "census_EthnicityBlack",
			label: "Census: Ethnicity Black (%)",
			group: "Census: Ethnicity",
		},
		{
			value: "census_EthnicityOther",
			label: "Census: Ethnicity Other (%)",
			group: "Census: Ethnicity",
		},
		// Group: Census Industry
		{
			value: "census_IndustryManufacturing",
			label: "Census: Industry Manufacturing (%)",
			group: "Census: Industry",
		},
		{
			value: "census_IndustrySocialWork",
			label: "Census: Industry Health/Social Work (%)",
			group: "Census: Industry",
		},
	];

	// --- MODIFICATION: Create grouped metrics for the select dropdown ---
	let groupedMetrics: Map<string, { value: string; label: string }[]> =
		new Map();
	$: {
		const newGroupedMetrics = new Map<
			string,
			{ value: string; label: string }[]
		>();
		metrics.forEach((metric) => {
			const group = metric.group || "Other"; // Fallback group
			if (!newGroupedMetrics.has(group)) {
				newGroupedMetrics.set(group, []);
			}
			newGroupedMetrics.get(group)?.push({
				value: metric.value,
				label: metric.label,
			});
		});
		// Optional: Sort groups if needed
		groupedMetrics = new Map(
			[...newGroupedMetrics.entries()].sort((a, b) =>
				a[0].localeCompare(b[0])
			)
		);
	}

	const partyColors: { [key: string]: string } = {
		con_voteshare: "#0087DC", // Conservative Blue
		lab_voteshare: "#E4003B", // Labour Red
		ld_voteshare: "#FAA61A", // Lib Dem Gold
		ref_voteshare: "#12B6CF", // Reform UK Teal
		green_voteshare: "#6AB023", // Green Party Green
		snp_voteshare: "#FFF95D", // SNP Yellow
		pc_voteshare: "#008142", // Plaid Cymru Green
		oth_voteshare: "#6B7280", // Neutral Gray for Other
	};

	// --- Helper Functions ---
	function getNumericValue(
		row: ConstituencyData | null | undefined,
		key: string
	): number | null {
		const value = row ? row[key] : null;
		if (value === null || value === undefined || value === "") return null;
		const num = Number(value);
		return Number.isFinite(num) ? num : null;
	}

	function debounce(func: (...args: any[]) => void, wait: number) {
		let timeout: number | undefined;
		return function executedFunction(...args: any[]) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = window.setTimeout(later, wait);
		};
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

		await new Promise(requestAnimationFrame);

		const currentParty = selectedParty;
		const currentMetric = selectedMetric;
		const selectedPartyLabel =
			parties.find((p) => p.value === currentParty)?.label ||
			currentParty;
		const selectedMetricLabel =
			metrics.find((m) => m.value === currentMetric)?.label ||
			currentMetric;
		const color = partyColors[currentParty] || "#6B7280";

		// 1. Prepare data
		const plotPoints: { x: number; y: number; text: string }[] = [];
		const statPoints: [number, number][] = [];
		for (const row of data) {
			const xVal = getNumericValue(row, currentMetric);
			const yVal = getNumericValue(row, currentParty);
			const name = row.constituency_name;

			// *** MODIFICATION: Filter out points where EITHER x OR y is 0 ***
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
				// Keep warning for negative y-values (likely data errors)
				console.warn(
					`Warning: Negative voteshare (${yVal}%) found for ${name}. Excluding from plot.`
				);
			}
			// Constituencies with xVal === 0 OR yVal === 0 are now implicitly excluded
		}

		try {
			await Plotly.purge(chartElement);
		} catch (e) {
			/* ignore purge errors */
		}

		// *** MODIFICATION: Update error message text ***
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
			// Extend slightly beyond the min/max *of the filtered data*
			const extendedXMin = xMin - xRange * 0.02;
			const extendedXMax = xMax + xRange * 0.02;

			let yMinCalc = regressionFunction(extendedXMin);
			let yMaxCalc = regressionFunction(extendedXMax);

			// Clamp regression line start/end points at y=0 if they go below
			const clampedYMin = Math.max(0, yMinCalc);
			const clampedYMax = Math.max(0, yMaxCalc);

			// Also clamp regression line start/end points at x=0 if they go below
			// (This is less likely given we filter x>0, but good practice)
			const finalXMin = Math.max(0, extendedXMin);
			const finalXMax = extendedXMax; // Max doesn't need clamping usually

			// Recalculate Y based on potentially clamped X
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
				`${selectedMetricLabel}: %{x:,.2f}<br>` + // Adjust format if needed
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
		// Determine tick format based on selected metric type
		let xAxisTickFormat = ".0f"; // Default
		if (
			selectedMetric.includes("price") ||
			selectedMetric.includes("income")
		) {
			xAxisTickFormat = ",.0f"; // Currency
		} else if (
			selectedMetric.includes("percentage") ||
			selectedMetric.includes("prop") || // Proportion
			selectedMetric.includes("share") || // Voteshare
			selectedMetric.includes("census_") // Assume most census are %
		) {
			xAxisTickFormat = ".1f"; // Percentage or ratio, maybe 1 decimal place
		} else if (selectedMetric.includes("score")) {
			xAxisTickFormat = ".1f"; // Scores might benefit from a decimal
		} else if (selectedMetric.includes("residents_per_household")) {
			xAxisTickFormat = ".1f"; // Average number
		}
		// Override specific cases if needed
		if (selectedMetric === "overall_local_score") xAxisTickFormat = ".1f";
		if (selectedMetric === "residents_per_household")
			xAxisTickFormat = ".2f"; // Maybe 2 decimals for avg household size

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
				zeroline: false, // Keep false as we start > 0
				rangemode: "tozero", // Still useful to ensure range includes values near zero if data is clustered there
				tickfont: { size: 11, color: "#6b7280" },
				tickformat: xAxisTickFormat, // Use dynamic format
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
				zeroline: true, // Keep true for Y axis (voteshare)
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
			// *** MODIFICATION: Update stats text ***
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

	// --- Lifecycle and Event Handling ---
	let resizeObserver: ResizeObserver | null = null;

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
		const debouncedUpdate = debounce(updateChart, 50); // Short debounce for responsiveness
		debouncedUpdate();
	}
</script>

<!-- Template -->
<div
	class="p-5 sm:p-6 md:p-8 max-w-5xl mx-auto font-sans bg-white bg-opacity-75 backdrop-blur-sm shadow-xl rounded-xl border border-gray-200/80"
>
	<!-- Dropdowns with improved spacing and focus states -->
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-6 md:mb-8">
		<div>
			<label
				for="party-select-{Math.random().toString(36).substring(2)}"
				class="block text-sm font-medium text-gray-700 mb-1.5"
			>
				Party Voteshare (Y-axis):
			</label>
			<select
				id="party-select-{Math.random().toString(36).substring(2)}"
				bind:value={selectedParty}
				class="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-400"
				disabled={isLoading}
			>
				{#each parties as party}
					<option value={party.value}>{party.label}</option>
				{/each}
			</select>
		</div>
		<div>
			<label
				for="metric-select-{Math.random().toString(36).substring(2)}"
				class="block text-sm font-medium text-gray-700 mb-1.5"
			>
				Metric/Variable (X-axis):
			</label>
			<!-- --- MODIFICATION: Use optgroup for metrics --- -->
			<select
				id="metric-select-{Math.random().toString(36).substring(2)}"
				bind:value={selectedMetric}
				class="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-400"
				disabled={isLoading}
			>
				{#each [...groupedMetrics.entries()] as [group, metricsInGroup]}
					<optgroup label={group}>
						{#each metricsInGroup as metric}
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
		>
			<!-- Plotly chart will render here -->
		</div>
		<!-- Placeholder for Loading/Error State -->
		<div
			bind:this={placeholderElement}
			class="absolute inset-0 flex items-center justify-center text-center text-gray-500 text-base p-4 bg-white/80 backdrop-blur-sm rounded-lg"
			style:display={isLoading || errorMessage ? "flex" : "none"}
			class:text-red-600={errorMessage}
		>
			<!-- Content is set dynamically in updateChart/onMount -->
		</div>
	</div>

	<!-- Stats Display Area -->
	<div
		bind:this={statsElement}
		class="mt-8 pt-4 text-sm text-gray-600 text-center min-h-[1.5em] border-t border-gray-200/80"
	>
		{@html statsText || "&nbsp;"}
		<!-- Use &nbsp; to maintain height when empty -->
	</div>
</div>
