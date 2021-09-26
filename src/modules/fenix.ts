// Handle everything that uses Fénix APIs

import fetch from "node-fetch";

import * as FenixTypings from "./fenix.d";

export const BaseUrl = "https://fenix.tecnico.ulisboa.pt/api/fenix/v1"; // no trailing slash!
export const Endpoints: { [name: string]: string } = {
	// always start with slash!
	aboutInfo: "/about",
	allDegrees: "/degrees/all",
};

export function buildUrl(endpoint: string): string {
	const url = new URL(BaseUrl + endpoint);
	url.searchParams.append("lang", "pt-PT");
	return url.toString();
}

export async function callEndpoint(endpoint: string): Promise<unknown> {
	try {
		return await (await fetch(buildUrl(endpoint))).json();
	} catch (e) {
		const name =
			Object.entries(Endpoints)
				.filter((e) => e[1] === endpoint)
				.map((e) => e[0])[0] ?? endpoint;
		console.error(
			`Fénix broke while calling endpoint ${name}: ${
				(e as Error).message
			}`
		);
		throw e; // propagate
	}
}

export async function getAboutInfo(): Promise<FenixTypings.AboutInfo> {
	return (await callEndpoint(Endpoints.aboutInfo)) as FenixTypings.AboutInfo;
}

export async function getCurrentAcademicTerm(): Promise<{
	year: string;
	semester: number;
}> {
	const match = (await getAboutInfo()).currentAcademicTerm.match(
		/(\d+)º \w+ (\d+\/\d+)/
	);
	if (match === null) {
		throw new Error("Could not get academic term!");
	} else {
		return { year: match[2], semester: parseInt(match[1]) };
	}
}

export async function getDegrees(): Promise<FenixTypings.ShortDegree[]> {
	const curYear = (await getCurrentAcademicTerm()).year;
	const degrees = (await callEndpoint(
		Endpoints.allDegrees
	)) as FenixTypings.ShortDegree[];
	return degrees.filter((d) => d.academicTerms.includes(curYear));
}
