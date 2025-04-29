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
