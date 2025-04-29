import type { MetricOption } from "./types";

// --- Metrics Configuration (Sorted & Aggregated) ---
// Note: Census values are generally counts unless specified otherwise.
export const metrics: MetricOption[] = [
	// === Group: Deprivation (IMD/SEISA/Census) - Importance #1 ===
	{
		value: "overall_local_score",
		label: "Overall Deprivation Score (IMD)",
		group: "Deprivation",
	},
	{
		value: "income_score",
		label: "Income Deprivation Score (IMD)",
		group: "Deprivation",
	},
	{
		value: "employment_score",
		label: "Employment Deprivation Score (IMD)",
		group: "Deprivation",
	},
	{
		value: "seisa_2021_proportion",
		label: "SEISA Deprivation Proportion",
		group: "Deprivation",
	},

	// *** UPDATED CENSUS DEPRIVATION METRICS ***
	{
		value: "census_DeprivedAny_pct",
		label: "Census: Households Deprived (Any Dim %)",
		group: "Deprivation",
	},
	{
		value: "census_Deprived1_pct",
		label: "Census: Households Deprived - 1 Dim (%)",
		group: "Deprivation",
	},
	{
		value: "census_Deprived2_pct",
		label: "Census: Households Deprived - 2 Dim (%)",
		group: "Deprivation",
	},
	{
		value: "census_Deprived3_pct",
		label: "Census: Households Deprived - 3 Dim (%)",
		group: "Deprivation",
	},
	{
		value: "census_Deprived4_pct",
		label: "Census: Households Deprived - 4 Dim (%)",
		group: "Deprivation",
	},
	// *** END UPDATED CENSUS DEPRIVATION METRICS ***
	// === Group: Economic - Importance #2 ===
	{
		value: "child_poverty_percentage_22_23",
		label: "Child Poverty (%)",
		group: "Economic",
	},
	{
		value: "median_house_price_2023",
		label: "Median House Price 2023 (£)",
		group: "Economic",
	},
	{
		value: "census_EconomicallyActive",
		label: "Census: Economically Active Pop",
		group: "Economic Activity",
	},
	{
		value: "census_EconomicallyInactive",
		label: "Census: Economically Inactive Pop",
		group: "Economic Activity",
	},
	{
		value: "census_InactiveLongTermSick",
		label: "Census: Inactive - Long-Term Sick",
		group: "Economic Activity",
	},
	{
		value: "census_NSSECLongtermUnemployed",
		label: "Census: NS-SEC Long-term Unemployed",
		group: "Economic Activity",
	},
	{
		value: "census_NoAdultsEmployed",
		label: "Census: Households w/ No Adults Employed",
		group: "Economic Activity",
	},
	// === Group: Census: Demographics (Age & Core) - Importance #3 ===
	{
		value: "census_PopulationDensity",
		label: "Census: Pop Density (per hectare)",
		group: "Census: Demographics (Core)",
	},
	{
		value: "census_Age0to15",
		label: "Census: Age 0-15",
		group: "Census: Demographics (Age)",
	},
	{
		value: "census_Age16to24",
		label: "Census: Age 16-24",
		group: "Census: Demographics (Age)",
	},
	{
		value: "census_Age25to39",
		label: "Census: Age 25-39",
		group: "Census: Demographics (Age)",
	},
	{
		value: "census_Age40to59",
		label: "Census: Age 40-59",
		group: "Census: Demographics (Age)",
	},
	{
		value: "census_Age60to74",
		label: "Census: Age 60-74",
		group: "Census: Demographics (Age)",
	},
	{
		value: "census_Age75plus",
		label: "Census: Age 75+",
		group: "Census: Demographics (Age)",
	},
	{
		value: "census_Communal",
		label: "Census: Communal Est. Residents",
		group: "Census: Demographics (Core)",
	},
	// === Group: Census: Socioeconomic (Occupation, Health, Education) - Importance #4 ===
	{
		value: "census_NSSECManagerialProfessional",
		label: "Census: NS-SEC Managerial/Professional",
		group: "Census: Socioeconomic (Occupation)",
	},
	{
		value: "census_NSSECIntermediate",
		label: "Census: NS-SEC Intermediate Occs",
		group: "Census: Socioeconomic (Occupation)",
	},
	{
		value: "census_NSSECRoutineSemiRoutine",
		label: "Census: NS-SEC Routine/Semi-Routine",
		group: "Census: Socioeconomic (Occupation)",
	},
	{
		value: "census_NSSECNeverWorked",
		label: "Census: NS-SEC Never Worked",
		group: "Census: Socioeconomic (Occupation)",
	},
	{
		value: "census_HealthBadVeryBad",
		label: "Census: Health Bad or Very Bad",
		group: "Census: Socioeconomic (Health)",
	},
	{
		value: "census_HealthFair",
		label: "Census: Health Fair",
		group: "Census: Socioeconomic (Health)",
	},
	{
		value: "census_HealthGoodVeryGood",
		label: "Census: Health Good or Very Good",
		group: "Census: Socioeconomic (Health)",
	},
	{
		value: "census_QualNone",
		label: "Census: No Qualifications",
		group: "Census: Socioeconomic (Education)",
	},
	{
		value: "census_QualLevel1_2",
		label: "Census: Qualifications Level 1-2",
		group: "Census: Socioeconomic (Education)",
	},
	{
		value: "census_QualLevel3Apprentice",
		label: "Census: Qualifications Level 3 / Apprentice",
		group: "Census: Socioeconomic (Education)",
	},
	{
		value: "census_QualLevel4Plus",
		label: "Census: Qualifications Level 4+",
		group: "Census: Socioeconomic (Education)",
	},
	// === Group: Housing & Households - Importance #5 ===
	{
		value: "census_HouseOwns",
		label: "Census: Home Ownership",
		group: "Housing & Households (Tenure)",
	},
	{
		value: "socialrent",
		label: "Proportion Social Housing (%)",
		group: "Housing & Households (Tenure)",
	},
	{
		value: "privaterent",
		label: "Proportion Renting (Private+Social) (%)",
		group: "Housing & Households (Tenure)",
	},
	{
		value: "census_HouseholdOnePerson",
		label: "Census: One Person Households",
		group: "Housing & Households (Structure)",
	},
	{
		value: "census_HouseholdFamily",
		label: "Census: Family Households",
		group: "Housing & Households (Structure)",
	},
	{
		value: "loneprop",
		label: "Proportion Lone Parent Households (%)",
		group: "Housing & Households (Structure)",
	},
	{
		value: "census_CarsNone",
		label: "Census: Households with No Car",
		group: "Housing & Households (Transport)",
	},
	{
		value: "census_CarsTwoPlus",
		label: "Census: Households with 2+ Cars",
		group: "Housing & Households (Transport)",
	},
	// === Group: Census: Ethnicity - Importance #6 ===
	{
		value: "census_EthnicityWhite",
		label: "Census: Ethnicity White",
		group: "Census: Ethnicity",
	},
	{
		value: "census_EthnicityWhiteBritish",
		label: "Census: Ethnicity White British",
		group: "Census: Ethnicity",
	},
	{
		value: "census_EthnicityMixed",
		label: "Census: Ethnicity Mixed/Multiple",
		group: "Census: Ethnicity",
	},
	{
		value: "census_EthnicityAsian",
		label: "Census: Ethnicity Asian",
		group: "Census: Ethnicity",
	},
	{
		value: "census_EthnicityBlack",
		label: "Census: Ethnicity Black",
		group: "Census: Ethnicity",
	},
	{
		value: "census_EthnicityOther",
		label: "Census: Ethnicity Other",
		group: "Census: Ethnicity",
	},
	// === Group: Census: Birthplace & Passports - Importance #7 ===
	{
		value: "census_BornUK",
		label: "Census: Born in UK",
		group: "Census: Birthplace & Passports",
	},
	{
		value: "census_BornEU",
		label: "Census: Born in EU (inc. Ireland)",
		group: "Census: Birthplace & Passports",
	},
	{
		value: "census_BornNonEU",
		label: "Census: Born Outside EU",
		group: "Census: Birthplace & Passports",
	},
	{
		value: "migrantprop",
		label: "Migrant Population Proportion (%)",
		group: "Census: Birthplace & Passports",
	},
	{
		value: "census_PassportUK",
		label: "Census: UK Passport",
		group: "Census: Birthplace & Passports",
	},
	{
		value: "census_PassportNonUK",
		label: "Census: Non-UK Passport",
		group: "Census: Birthplace & Passports",
	},
	{
		value: "census_PassportNone",
		label: "Census: No Passport Held",
		group: "Census: Birthplace & Passports",
	},
	// === Group: Census: Religion - Importance #8 ===
	{
		value: "census_Christian",
		label: "Census: Religion Christian",
		group: "Census: Religion",
	},
	{
		value: "census_Muslim",
		label: "Census: Religion Muslim",
		group: "Census: Religion",
	},
	{
		value: "census_Hindu",
		label: "Census: Religion Hindu",
		group: "Census: Religion",
	},
	{
		value: "census_Sikh",
		label: "Census: Religion Sikh",
		group: "Census: Religion",
	},
	{
		value: "census_Jewish",
		label: "Census: Religion Jewish",
		group: "Census: Religion",
	},
	{
		value: "census_Buddhist",
		label: "Census: Religion Buddhist",
		group: "Census: Religion",
	},
	{
		value: "census_NoReligion",
		label: "Census: No Religion",
		group: "Census: Religion",
	},
	{
		value: "census_ReligionOtherOrNotStated",
		label: "Census: Religion Other / Not Stated",
		group: "Census: Religion",
	},
	// === Group: Census: Industry - Importance #9 ===
	{
		value: "census_IndustrySocialWork",
		label: "Census: Industry Health/Social Work",
		group: "Census: Industry",
	},
	{
		value: "census_IndustryEducation",
		label: "Census: Industry Education",
		group: "Census: Industry",
	},
	{
		value: "census_IndustryWholesale",
		label: "Census: Industry Wholesale/Retail/Motor",
		group: "Census: Industry",
	},
	{
		value: "census_IndustryConstruction",
		label: "Census: Industry Construction",
		group: "Census: Industry",
	},
	{
		value: "census_IndustryManufacturing",
		label: "Census: Industry Manufacturing",
		group: "Census: Industry",
	},
	{
		value: "census_IndustryPublicAdministration",
		label: "Census: Industry Public Admin/Defence",
		group: "Census: Industry",
	},
];
