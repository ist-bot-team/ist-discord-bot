import Discord, { EmbedBuilder, HexColorString } from "discord.js";
import { PrismaClient } from "@prisma/client";
import cron from "node-cron";
import TurndownService from "turndown";

import * as FenixAPI from "./fenix";
import * as FenixTypings from "./fenix.d";

const turndownService = new TurndownService();

export function scheduleRSSFeedJob(
	prisma: PrismaClient,
	client: Discord.Client
): void {
	cron.schedule("*/2 * * * *", runRSSFeedJob(prisma, client));
}

export function runRSSFeedJob(
	prisma: PrismaClient,
	client: Discord.Client
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
				const degreeChannel = await client.channels.fetch(
					course.degree.degreeTextChannelId || ""
				);
				if (!degreeChannel?.isTextBased()) return;

				const announcements =
					await FenixAPI.getRSSFeed<FenixTypings.RSSCourseAnnouncement>(
						course.announcementsFeedUrl || "",
						course.feedLastUpdated
					);

				await announcements.reduce(
					async (prevPromise, announcement) => {
						await prevPromise;

						await degreeChannel.send({
							content: `Novo anúncio de ${course.course.name}${
								course.course.roleId
									? ` <@&${course.course.roleId}>`
									: ``
							}`,
							embeds: [
								new EmbedBuilder()
									.setTitle(
										announcement.title?.substring(0, 256)
									)
									.setDescription(
										turndownService
											.turndown(
												announcement.content ||
													"Não foi possível obter o conteúdo deste anúncio"
											)
											.substring(0, 2048)
									)
									.setURL(announcement.link)
									.setColor(
										(course.color as HexColorString) ||
											"#00a0e4"
									)
									.setAuthor({
										name:
											announcement.author.match(
												/\((.+)\)/
											)?.[1] || announcement.author,
									})
									.setFooter({
										text: course.course.name,
									})
									.setTimestamp(
										new Date(announcement.pubDate)
									),
							],
						});
					},
					Promise.resolve()
				);

				if (announcements.length > 0) {
					const date = new Date(announcements.pop()?.pubDate || ".");
					await prisma.degreeCourse.update({
						where: { id: course.id },
						data: { feedLastUpdated: date },
					});
				}
			});
	};
}
