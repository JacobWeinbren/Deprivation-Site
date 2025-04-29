import Papa from "papaparse";
import type { PageServerLoad } from "./$types";
import type { ConstituencyData } from "$lib/components/scatter/types";

// Import the raw content of the CSV file at build time
import csvFileContent from "$lib/data/constituency_data.csv?raw";

export const load: PageServerLoad = async () => {
	let chartData: ConstituencyData[] = [];
	let error: string | null = null;

	try {
		// Check if the imported content is available
		if (typeof csvFileContent !== "string" || csvFileContent.length === 0) {
			throw new Error(
				"CSV file content was not loaded correctly during build."
			);
		}

		// Parse the imported CSV content
		const parseResult = Papa.parse<ConstituencyData>(csvFileContent, {
			header: true,
			skipEmptyLines: true,
			dynamicTyping: true, // Convert numbers/booleans
			transformHeader: (header) => header.trim(), // Remove whitespace
		});

		// Handle parsing errors
		if (parseResult.errors && parseResult.errors.length > 0) {
			console.error("CSV Parsing Errors:", parseResult.errors);

			// Create a summary of the first few errors for the UI
			const errorSummary = parseResult.errors
				.slice(0, 3)
				.map((err) => `${err.code} at row ${err.row}: ${err.message}`)
				.join("; ");

			error = `CSV parsing issues: ${errorSummary}${
				parseResult.errors.length > 3
					? ` and ${parseResult.errors.length - 3} more`
					: ""
			}`;

			// Only throw if the errors are critical (no data returned)
			if (parseResult.data.length === 0) {
				throw new Error(
					`CSV parsing failed completely: ${parseResult.errors[0].message}`
				);
			}
		}

		// Filter out invalid rows
		chartData = parseResult.data.filter(
			(row) =>
				row &&
				row.constituency_name &&
				typeof row.constituency_name === "string" &&
				row.const_code &&
				typeof row.const_code === "string"
		);

		// Log info about the loaded data
		console.log(`Loaded ${chartData.length} valid constituencies from CSV`);

		if (chartData.length === 0) {
			error = error || "No valid constituency data found in the CSV file";
		}

		// Validate some key metrics and voteshare fields exist
		const sampleRow = chartData[0];
		if (sampleRow) {
			const essentialKeys = [
				"con_voteshare",
				"lab_voteshare",
				"ld_voteshare",
				"overall_local_score",
				"income_score",
				"employment_score",
			];

			const missingKeys = essentialKeys.filter(
				(key) => sampleRow[key] === undefined || sampleRow[key] === null
			);

			if (missingKeys.length > 0) {
				console.warn(
					`Warning: Some important data fields are missing: ${missingKeys.join(
						", "
					)}`
				);
				if (!error) {
					error = `Warning: Some data fields may be missing (${missingKeys.join(
						", "
					)})`;
				}
			}
		}
	} catch (err: any) {
		console.error("Error processing constituency data:", err);
		error = `Failed to process constituency data: ${err.message}`;
		chartData = []; // Ensure data is empty on error
	}

	return {
		chartData,
		error,
	};
};
