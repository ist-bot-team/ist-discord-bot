// Handle everything that uses Fénix APIs

import axios from "axios";
import cheerio from "cheerio";

import * as FenixTypings from "./fenix.d";
import * as utils from "./utils";

export const axiosClient = axios.create({
	baseURL: "https://fenix.tecnico.ulisboa.pt",
	params: {
		lang: "pt-PT",
	},
});

export async function callEndpoint(endpoint: string): Promise<unknown> {
	try {
		return (await axiosClient.get(endpoint)).data;
	} catch (e) {
		console.error(
			`Fénix broke while calling endpoint '${endpoint}': ${
				(e as Error).message
			}`
		);
		throw e; // propagate
	}
}

export async function getAboutInfo(): Promise<FenixTypings.AboutInfo> {
	return (await callEndpoint(
		"/api/fenix/v1/about"
	)) as FenixTypings.AboutInfo;
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
		"/api/fenix/v1/degrees/all"
	)) as FenixTypings.ShortDegree[];
	return degrees.filter((d) => d.academicTerms.includes(curYear));
}

export async function getDegreeCourses(
	degreeId: string
): Promise<FenixTypings.FenixDegreeCourse[]> {
	const degrees = await getDegrees();
	const shortDegree = degrees.find((d) => d.id.toLowerCase() === degreeId);

	if (shortDegree === undefined) {
		throw new Error(`Could not find degree with ID ${degreeId}`);
	}

	const degreeAcronym = shortDegree.acronym.toLowerCase();

	const curriculumHtml = (await callEndpoint(
		`/cursos/${degreeAcronym}/curriculo`
	)) as string;

	const $ = cheerio.load(curriculumHtml);

	const courses = await Promise.all(
		$("#bySemesters .row")
			.map(function () {
				const hrefEl = $(".row div:first a", this).first();
				const courseName = hrefEl.text()?.trim() || "";
				const courseLink = hrefEl.attr("href")?.trim() || "";
				const yearSemester = $(".row div div", null, this)
					.first()
					.text()
					?.trim();
				const year =
					parseInt(yearSemester.match(/Ano (\d)/)?.[1] || "0", 10) ||
					0;
				const semester =
					parseInt(
						yearSemester.match(/Sem\. (\d)/)?.[1] || "0",
						10
					) ||
					(parseInt(yearSemester.match(/P (\d)/)?.[1] || "0", 10) <= 2
						? 1
						: 2) ||
					0;

				return {
					name: courseName,
					acronym: courseLink,
					year,
					semester,
				};
			})
			.toArray()
			.filter(({ name }) => !name.startsWith("HASS "))
			.map(async (course: FenixTypings.FenixDegreeCourse) => {
				const coursePageHtml = (await callEndpoint(
					course.acronym
				)) as string;
				const acronym =
					cheerio
						.load(coursePageHtml)("#content-block h1 small")
						.first()
						.text()
						?.trim() || course.name;

				return { ...course, acronym };
			})
	);

	return utils.removeDuplicatesFromArray(
		courses,
		(courses) => courses.acronym
	);
}
