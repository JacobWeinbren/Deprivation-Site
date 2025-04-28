// src/lib/components/scatter/chartConfig.ts

// --- Types ---
export interface ConstituencyData {
	constituency_name: string;
	const_code: string;
	[key: string]: string | number | undefined | null;
}

export interface MetricOption {
	value: string;
	label: string;
	group: string;
}

export interface PartyOption {
	value: string;
	label: string;
}

// --- Configuration ---
// MODIFIED: Darker party colors
export const parties: PartyOption[] = [
	{ value: "con_voteshare", label: "Conservative Voteshare 2024 (%)" },
	{ value: "lab_voteshare", label: "Labour Voteshare 2024 (%)" },
	{ value: "ld_voteshare", label: "Lib Dem Voteshare 2024 (%)" },
	{ value: "ref_voteshare", label: "Reform UK Voteshare 2024 (%)" },
	{ value: "green_voteshare", label: "Green Voteshare 2024 (%)" },
	{ value: "oth_voteshare", label: "Other Voteshare 2024 (%)" },
];

export const metrics: MetricOption[] = [
	// Group: Deprivation (IMD/SEISA) - Importance #1
	{
		value: "overall_local_score",
		label: "Overall Deprivation Score (IMD)", // Broadest
		group: "Deprivation (IMD/SEISA)",
	},
	{
		value: "seisa_2021_proportion",
		label: "SEISA Deprivation Proportion", // Other composite
		group: "Deprivation (IMD/SEISA)",
	},
	{
		value: "income_score",
		label: "Income Deprivation Score (IMD)", // Core component
		group: "Deprivation (IMD/SEISA)",
	},
	{
		value: "employment_score",
		label: "Employment Deprivation Score (IMD)", // Core component
		group: "Deprivation (IMD/SEISA)",
	},
	// Group: Economic - Importance #2
	{
		value: "child_poverty_percentage_22_23",
		label: "Child Poverty %", // Direct poverty measure
		group: "Economic",
	},
	{
		value: "median_house_price_2023",
		label: "Median House Price 2023 (£)", // Major asset/cost
		group: "Economic",
	},
	// Group: Housing - Importance #3
	{
		value: "census_HouseOwns",
		label: "Census: Home Ownership (%)", // Key tenure status
		group: "Housing",
	},
	{
		value: "census_HouseSocialRent",
		label: "Census: Social Renting (%)", // Indicator of need
		group: "Housing",
	},
	{
		value: "census_HousePrivateRent",
		label: "Census: Private Renting (%)", // Other major renting category
		group: "Housing",
	},
	{
		value: "socialrent",
		label: "Proportion Social Housing (%)", // Original social rent metric
		group: "Housing",
	},
	{
		value: "privaterent",
		label: "Proportion Renting (Private+Social) (%)", // Combined original metric
		group: "Housing",
	},
	{
		value: "residents_per_household",
		label: "Census: Residents per Household", // Density/household size
		group: "Housing",
	},
	// Group: Social/Demographic - Importance #4
	{
		value: "poorhealth",
		label: "Poor Health Proportion (%)", // Fundamental indicator
		group: "Social/Demographic",
	},
	{
		value: "propqual",
		label: "Proportion Low Qualifications (%)", // Education/Skills
		group: "Social/Demographic",
	},
	{
		value: "propocc",
		label: "Proportion NSSEC 3-8 (%)", // Occupation class
		group: "Social/Demographic",
	},
	{
		value: "loneprop",
		label: "Proportion Lone Parent Households (%)", // Household structure/vulnerability
		group: "Social/Demographic",
	},
	{
		value: "oldpop",
		label: "Old Population Proportion (%)", // Original age metric
		group: "Social/Demographic",
	},
	{
		value: "youngpop",
		label: "Young Population Proportion (%)", // Original age metric
		group: "Social/Demographic",
	},
	{
		value: "migrantprop",
		label: "Migrant Population Proportion (%)", // Migration status
		group: "Social/Demographic",
	},
	// Group: Census: Demographics - Importance #5 (Census Start)
	{
		value: "census_Age0to15",
		label: "Census: Population Aged 0-15 (%)",
		group: "Census: Demographics",
	},
	{
		value: "census_Age16to24",
		label: "Census: Population Aged 16-24 (%)",
		group: "Census: Demographics",
	},
	{
		value: "census_Age25to39",
		label: "Census: Population Aged 25-39 (%)",
		group: "Census: Demographics",
	},
	{
		value: "census_Age40to59",
		label: "Census: Population Aged 40-59 (%)",
		group: "Census: Demographics",
	},
	{
		value: "census_Age60to74",
		label: "Census: Population Aged 60-74 (%)",
		group: "Census: Demographics",
	},
	{
		value: "census_Age75plus",
		label: "Census: Population Aged 75+ (%)",
		group: "Census: Demographics",
	},
	// Group: Census: Occupation/Activity - Importance #6
	{
		value: "census_InactiveLongTermSick",
		label: "Census: Inactive (Long-Term Sick) (%)", // Significant inactivity reason
		group: "Census: Occupation/Activity",
	},
	{
		value: "census_RoutineSemiRoutine",
		label: "Census: Routine/Semi-Routine Occupations (%)", // Occupation type
		group: "Census: Occupation/Activity",
	},
	// Group: Census: Ethnicity - Importance #7
	{
		value: "census_EthnicityWhite",
		label: "Census: Ethnicity White (%)", // Largest group
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
		value: "census_EthnicityMixed",
		label: "Census: Ethnicity Mixed (%)",
		group: "Census: Ethnicity",
	},
	{
		value: "census_EthnicityOther",
		label: "Census: Ethnicity Other (%)",
		group: "Census: Ethnicity",
	},
	// Group: Census: Birthplace - Importance #8
	{
		value: "census_BornNonEU",
		label: "Census: Born Outside EU (%)", // Often focus of discussion
		group: "Census: Birthplace",
	},
	{
		value: "census_BornEU",
		label: "Census: Born in EU (%)",
		group: "Census: Birthplace",
	},
	// Group: Census: Transport - Importance #9
	{
		value: "census_CarsNone",
		label: "Census: Households with No Car (%)", // Indicator of potential disadvantage/urbanicity
		group: "Census: Transport",
	},
	{
		value: "census_CarsTwoPlus",
		label: "Census: Households with 2+ Cars (%)", // Indicator of affluence/suburban/rural
		group: "Census: Transport",
	},
	// Group: Census: Industry - Importance #10
	{
		value: "census_IndustrySocialWork",
		label: "Census: Industry Health/Social Work (%)", // Major sector
		group: "Census: Industry",
	},
	{
		value: "census_IndustryManufacturing",
		label: "Census: Industry Manufacturing (%)", // Traditional sector
		group: "Census: Industry",
	},
];

// MODIFIED: Darker party colors
export const partyColors: { [key: string]: string } = {
	con_voteshare: "#00538C", // Darker Conservative Blue
	lab_voteshare: "#C7002F", // Darker Labour Red
	ld_voteshare: "#EAA000", // Darker Lib Dem Gold
	ref_voteshare: "#0A8AA0", // Darker Reform UK Teal
	green_voteshare: "#528D1C", // Darker Green Party Green
	snp_voteshare: "#FDF34B", // Slightly adjusted SNP Yellow
	pc_voteshare: "#006131", // Darker Plaid Cymru Green
	oth_voteshare: "#52525B", // Darker Neutral Gray for Other
};

// --- Derived Data ---
export function getGroupedMetrics(
	metricList: MetricOption[]
): Map<string, { value: string; label: string }[]> {
	const newGroupedMetrics = new Map<
		string,
		{ value: string; label: string }[]
	>();
	metricList.forEach((metric) => {
		const group = metric.group || "Other"; // Fallback group
		if (!newGroupedMetrics.has(group)) {
			newGroupedMetrics.set(group, []);
		}
		newGroupedMetrics
			.get(group)
			?.push({ value: metric.value, label: metric.label });
	});
	// Keep original order from the metrics array
	const orderedMap = new Map<string, { value: string; label: string }[]>();
	const groupOrder: string[] = [];
	metricList.forEach((metric) => {
		const group = metric.group || "Other";
		if (!groupOrder.includes(group)) {
			groupOrder.push(group);
		}
	});
	groupOrder.forEach((groupName) => {
		if (newGroupedMetrics.has(groupName)) {
			orderedMap.set(groupName, newGroupedMetrics.get(groupName)!);
		}
	});
	return orderedMap;
}

export const groupedMetrics = getGroupedMetrics(metrics);
