// src/routes/+page.server.ts
// REMOVE: import fs from "fs";
// REMOVE: import path from "path";
import Papa from "papaparse";
import type { PageServerLoad } from "./$types";

// Import the raw content of the CSV file at build time
import csvFileContent from "$lib/data/constituency_data.csv?raw";

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
	ref_voteshare?: number | null; // Corrected key if using 'ref_' in CSV
	green_voteshare?: number | null;
	pc_voteshare?: number | null; // Added Plaid Cymru if present
	oth_voteshare?: number | null;
	[key: string]: string | number | undefined | null; // Allow other properties
}

export const load: PageServerLoad = async () => {
	let chartData: ConstituencyDataRow[] = [];
	let error: string | null = null;

	// No longer need to construct file path or check existence with fs
	// const csvFilePath = path.resolve(process.cwd(), 'src/lib/data/constituency_data.csv');
	// console.log(`Attempting to load CSV from: ${csvFilePath}`); // Keep for local debug if needed

	try {
		// Check if the imported content is actually a string (it should be)
		if (typeof csvFileContent !== "string" || csvFileContent.length === 0) {
			throw new Error(
				"CSV file content was not loaded correctly during build."
			);
		}

		// Parse the imported string content directly
		const parseResult = Papa.parse<ConstituencyDataRow>(csvFileContent, {
			header: true,
			skipEmptyLines: true,
			dynamicTyping: true, // Attempts to convert numbers/booleans
			transformHeader: (header) => header.trim(), // Good practice
		});

		if (parseResult.errors.length > 0) {
			console.error("CSV Parsing Errors:", parseResult.errors);
			// Consider how critical these errors are. Maybe throw an error or just log.
			// Example: Only log the first few errors
			error = `Encountered ${parseResult.errors.length} errors during CSV parsing. Check console logs.`;
			// Optionally throw if any error is critical:
			// throw new Error(`CSV Parsing failed: ${parseResult.errors[0].message}`);
		}

		// Filter out rows missing essential identifiers or with parsing issues if needed
		chartData = parseResult.data.filter(
			(row) =>
				row && // Ensure row object exists
				row.constituency_name &&
				typeof row.constituency_name === "string" &&
				row.const_code // Ensure const_code is present
		);

		if (chartData.length === 0 && parseResult.data.length > 0) {
			console.warn(
				"CSV parsed, but no valid rows found after filtering (missing name or code?)."
			);
			// Potentially set an error if no data is usable
			if (!error) {
				// Avoid overwriting a parsing error
				error =
					"Loaded data but could not find valid constituency rows.";
			}
		} else {
			console.log(
				`Successfully parsed ${chartData.length} valid constituency rows from imported content.`
			);
		}
	} catch (err: any) {
		console.error("Error processing imported CSV content:", err);
		error = `Failed to process constituency data: ${err.message}`;
		chartData = []; // Ensure data is empty on error
	}

	return {
		chartData, // Pass the loaded data to the page component
		error, // Pass any error message
	};
};
