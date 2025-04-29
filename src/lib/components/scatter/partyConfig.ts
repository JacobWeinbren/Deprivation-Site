import type { PartyOption } from "./types";

// --- Party Configuration ---
export const parties: PartyOption[] = [
	{ value: "swing_con_lab_19_24", label: "Swing '19-'24 (Con-Lab, %)" },
	{ value: "brexit_leave_share", label: "Est. Leave Share 2016 (%)" },
	{ value: "con_voteshare", label: "Conservative Voteshare 2024 (%)" },
	{ value: "lab_voteshare", label: "Labour Voteshare 2024 (%)" },
	{ value: "ld_voteshare", label: "Lib Dem Voteshare 2024 (%)" },
	{ value: "ref_voteshare", label: "Reform UK Voteshare 2024 (%)" },
	{ value: "green_voteshare", label: "Green Voteshare 2024 (%)" },
	{ value: "oth_voteshare", label: "Other Voteshare 2024 (%)" },
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
