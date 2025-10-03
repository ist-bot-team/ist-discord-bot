import Discord, {
	EmbedBuilder,
	HexColorString,
	SendableChannels,
} from "discord.js";
import { Course, Degree, PrismaClient } from "@prisma/client";
import cron from "node-cron";
import TurndownService from "turndown";

import * as FenixAPI from "./fenix";
import * as FenixTypings from "./fenix.d";
import logger from "../logger";

const turndownService = new TurndownService();

export function scheduleRSSFeedJob(
	prisma: PrismaClient,
	client: Discord.Client,
): void {
	cron.schedule("*/2 * * * *", runRSSFeedJob(prisma, client));
}

export function runRSSFeedJob(
	prisma: PrismaClient,
	client: Discord.Client,
): () => Promise<void> {
	return async function () {
		const degreeCourse = await prisma.degreeCourse.findMany({
			select: {
				id: true,
				announcementsFeedUrl: true,
				feedLastUpdated: true,
				color: true,
				degree: true,
				course: true,
			},
		});

		degreeCourse
			.filter((course) => !!course.announcementsFeedUrl)
			.forEach(async (course) => {
				try {
					await fetchRSSForCourse(course, prisma, client);
				} catch (e) {
					logger.error(
						{
							err: e,
							course: course.course.name,
							degree: course.degree.name,
						},
						"Failed to fetch and send announcements for course",
					);
				}
			});
	};
}

type DegreeCourse = {
	degree: Degree;
	course: Course;
	announcementsFeedUrl: string | null;
	feedLastUpdated: Date;
	color: string | null;
	id: string;
};

async function fetchRSSForCourse(
	course: DegreeCourse,
	prisma: PrismaClient,
	client: Discord.Client,
): Promise<void> {
	const degreeChannel = await client.channels.fetch(
		course.degree.degreeTextChannelId || "",
	);
	if (!degreeChannel?.isSendable()) return;

	const announcements =
		await FenixAPI.getRSSFeed<FenixTypings.RSSCourseAnnouncement>(
			course.announcementsFeedUrl || "",
			course.feedLastUpdated,
		);

	for (const announcement of announcements) {
		await sendAnnouncementMessage(course, degreeChannel, announcement);
	}

	if (announcements.length > 0) {
		const date = new Date(announcements.pop()?.pubDate || ".");
		await prisma.degreeCourse.update({
			where: { id: course.id },
			data: { feedLastUpdated: date },
		});
	}
}

async function sendAnnouncementMessage(
	course: DegreeCourse,
	channel: SendableChannels,
	announcement: FenixTypings.RSSCourseAnnouncement,
) {
	const roleMention = course.course.roleId
		? ` <@&${course.course.roleId}>`
		: ``;
	const color = (course.color as HexColorString) || "#00a0e4";
	// get the name of the author inside brackets
	// format is "email@tecnico.ulisboa.pt (Name)"
	const authorName =
		announcement.author.match(/\((.+)\)/)?.[1] || announcement.author;

	const content =
		turndownService
			.turndown(announcement.content ?? "")
			.substring(0, 2048) ||
		"Não foi possível obter o conteúdo deste anúncio";

	logger.debug(
		{
			roleMention,
			color,
			authorName,
			content,
			courseName: course.course.name,
			channel,
		},
		"Sending course announcement",
	);

	await channel.send({
		content: `Novo anúncio de ${course.course.name}${roleMention}`,
		embeds: [
			new EmbedBuilder()
				.setTitle(announcement.title?.substring(0, 256))
				.setDescription(content)
				.setURL(announcement.link)
				.setColor(color)
				.setAuthor({ name: authorName })
				.setFooter({ text: course.course.name })
				.setTimestamp(new Date(announcement.pubDate)),
		],
	});
}
