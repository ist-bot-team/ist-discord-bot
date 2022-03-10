// Handle everything that uses Fénix APIs

import axios from "axios";
import cheerio from "cheerio";
import RSSParser from "rss-parser";

import * as FenixTypings from "./fenix.d";
import * as utils from "./utils";

const parser = new RSSParser();

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
	degreeId: string,
	academicYear: string
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
				const $coursePage = cheerio.load(coursePageHtml);
				const acronym =
					$coursePage("#content-block h1 small")
						.first()
						.text()
						?.trim() || course.name;

				const executionCourseUrl = $coursePage("#content-block a")
					.map((_, linkNode) => {
						const executionCourseLink = $coursePage(linkNode)
							.attr("href")
							?.match(/\/disciplinas\/\w+\/([\w-]+)\/[\w-]+/);
						if (
							!executionCourseLink ||
							executionCourseLink[1] !== academicYear
						)
							return null;

						return executionCourseLink[0];
					})
					.toArray()
					.find((v) => !!v);

				const rssUrl =
					executionCourseUrl &&
					`${executionCourseUrl}/rss/announcement`;

				return { ...course, acronym, announcementsFeedUrl: rssUrl };
			})
	);

	return utils.removeDuplicatesFromArray(
		courses,
		(courses) => courses.acronym
	);
}

export async function getRSSFeed<T extends FenixTypings.RSSFeedItem>(
	url: string,
	after: Date
): Promise<T[]> {
	try {
		const data = await callEndpoint(url);
		const json = await parser.parseString(data as string);

		let item: T[] = (json?.items || []) as T[];
		if (!Array.isArray(item)) item = [item];

		return item
			.filter((v) => new Date(v.pubDate) > after)
			.sort(
				(a, b) =>
					new Date(a.pubDate).getTime() -
					new Date(b.pubDate).getTime()
			);
	} catch (e) {
		console.error(
			`Could not get RSS feed for '${url}': ${(e as Error).message}`
		);
		return [];
	}
}
