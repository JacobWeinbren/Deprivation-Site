import Papa from "papaparse";
import type { PageServerLoad } from "./$types";
import type { ConstituencyData } from "$lib/types"; // Updated path

// Import the raw content of the CSV file at build time
import csvFileContent from "$lib/data/constituency_data.csv?raw";

export const load: PageServerLoad = async () => {
	let chartData: ConstituencyData[] = [];
	let error: string | null = null;

	try {
		if (typeof csvFileContent !== "string" || csvFileContent.length === 0) {
			throw new Error(
				"CSV file content was not loaded correctly during build."
			);
		}

		const parseResult = Papa.parse<ConstituencyData>(csvFileContent, {
			header: true,
			skipEmptyLines: true,
			dynamicTyping: true, // Convert numbers/booleans
			transformHeader: (header) => header.trim(),
		});

		if (parseResult.errors && parseResult.errors.length > 0) {
			console.error("CSV Parsing Errors:", parseResult.errors);
			const errorSummary = parseResult.errors
				.slice(0, 3)
				.map((err) => `${err.code} at row ${err.row}: ${err.message}`)
				.join("; ");
			error = `CSV parsing issues: ${errorSummary}${
				parseResult.errors.length > 3
					? ` and ${parseResult.errors.length - 3} more`
					: ""
			}`;
			if (parseResult.data.length === 0) {
				throw new Error(
					`CSV parsing failed completely: ${parseResult.errors[0].message}`
				);
			}
		}

		// Filter out rows without essential identifiers
		chartData = parseResult.data.filter(
			(row): row is ConstituencyData =>
				!!row &&
				typeof row.constituency_name === "string" &&
				!!row.constituency_name &&
				typeof row.const_code === "string" &&
				!!row.const_code
		);

		console.log(`Loaded ${chartData.length} valid constituencies from CSV`);

		if (chartData.length === 0) {
			error = error || "No valid constituency data found in the CSV file";
		}

		// Optional: Validate some key metrics exist in the first row
		const sampleRow = chartData[0];
		if (sampleRow) {
			const essentialKeys = [
				"con_voteshare",
				"lab_voteshare",
				"overall_local_score",
			];
			const missingKeys = essentialKeys.filter(
				(key) => !(key in sampleRow)
			);
			if (missingKeys.length > 0) {
				console.warn(
					`Warning: Some expected data fields might be missing: ${missingKeys.join(
						", "
					)}`
				);
				// Optionally append to error message
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
