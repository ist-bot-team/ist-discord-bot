// Controller for everything courses

import { PrismaClient } from "@prisma/client";

import * as Discord from "discord.js";
import { OrphanChannel } from "./courses.d";
import * as fenix from "./fenix";

export async function importCoursesFromDegree(
	prisma: PrismaClient,
	degreeId: string
): Promise<void> {
	const degreeCourses = await fenix.getDegreeCourses(degreeId);

	await Promise.all(
		degreeCourses.map(async (course) => {
			const globalCourse = await prisma.course.findUnique({
				where: { acronym: course.acronym },
			});

			if (!globalCourse) {
				// Create global course since it doesn't exist

				await prisma.course.create({
					data: {
						acronym: course.acronym,
						displayAcronym: course.acronym,
						name: course.name,
					},
				});
			}

			await prisma.degreeCourse.create({
				data: {
					id: `${degreeId}-${course.acronym}`,
					degreeFenixId: degreeId,
					courseAcronym: course.acronym,
					year: course.year,
					semester: course.semester,
				},
			});
		})
	);
}

export async function refreshCourses(
	prisma: PrismaClient,
	guild: Discord.Guild
): Promise<OrphanChannel[]> {
	/*const degrees = await prisma.degree.findMany({});

	degrees.forEach(async (degree) => {
		console.log(degree.fenixId);
		console.log(await fenix.getDegreeCourses(degree.fenixId));
	});*/

	return [];
}
