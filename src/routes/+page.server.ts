// src/routes/+page.server.ts
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import type { PageServerLoad } from "./$types";

// Define the expected structure of a row in your CSV data
interface ConstituencyDataRow {
	constituency_name: string;
	const_code: string;
	total_population?: number | null;
	median_house_price_2023?: number | null;
	overall_local_score?: number | null; // IMD Score
	income_score?: number | null; // Income Deprivation
	employment_score?: number | null; // Employment Deprivation
	propqual?: number | null; // Proportion below level 4 qualifications
	propocc?: number | null; // Proportion NSSEC 3-8
	privaterent?: number | null; // Proportion private/social rent
	socialrent?: number | null; // Proportion social housing
	poorhealth?: number | null; // Proportion bad/very bad health
	loneprop?: number | null; // Proportion lone parent households
	seisa_2021_proportion?: number | null; // SEISA Proportion (Deprivation)
	con_voteshare?: number | null;
	lab_voteshare?: number | null;
	ld_voteshare?: number | null;
	ruk_voteshare?: number | null; // Assuming Reform UK
	green_voteshare?: number | null;
	oth_voteshare?: number | null;
	[key: string]: string | number | undefined | null; // Allow other properties
}

export const load: PageServerLoad = async () => {
	let chartData: ConstituencyDataRow[] = [];
	let error: string | null = null;

	// Construct the absolute path to the CSV file relative to the project root
	// Note: Adjust path if your project structure differs or if running in specific environments
	const csvFilePath = path.resolve(
		process.cwd(),
		"src/lib/data/constituency_data.csv"
	);
	console.log(`Attempting to load CSV from: ${csvFilePath}`);

	try {
		if (!fs.existsSync(csvFilePath)) {
			throw new Error(`CSV file not found at ${csvFilePath}`);
		}

		const csvFileContent = fs.readFileSync(csvFilePath, "utf-8");
		const parseResult = Papa.parse<ConstituencyDataRow>(csvFileContent, {
			header: true,
			skipEmptyLines: true,
			dynamicTyping: true,
			transformHeader: (header) => header.trim(),
		});

		if (parseResult.errors.length > 0) {
			console.error("CSV Parsing Errors:", parseResult.errors);
			// Decide if errors are critical. Maybe filter out rows with errors.
			// For now, we'll log and continue.
		}

		// Filter out rows missing essential identifiers
		chartData = parseResult.data.filter(
			(row) =>
				row.constituency_name &&
				typeof row.constituency_name === "string" &&
				row.const_code
		);
		console.log(
			`Successfully loaded and parsed ${chartData.length} valid constituency rows.`
		);
	} catch (err: any) {
		console.error("Error loading or parsing CSV file:", err);
		error = `Failed to load constituency data: ${err.message}`;
		chartData = []; // Ensure data is empty on error
	}

	return {
		chartData, // Pass the loaded data to the page component
		error, // Pass any error message
	};
};
