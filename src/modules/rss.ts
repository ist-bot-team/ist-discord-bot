import Discord from "discord.js";
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
	cron.schedule("*/5 * * * *", runRSSFeedJob(prisma, client));
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
				if (!degreeChannel?.isText()) return;

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
								{
									title: announcement.title?.substring(
										0,
										256
									),
									description: turndownService
										.turndown(
											announcement.content ||
												"Não foi possível obter o conteúdo deste anúncio"
										)
										.substring(0, 2048),
									url: announcement.link,
									color: parseInt("#00a0e4".substring(1), 16),
									author: {
										name:
											announcement.author.match(
												/\((.+)\)/
											)?.[1] || announcement.author,
									},
									footer: {
										text: course.course.name,
									},
									timestamp: new Date(announcement.pubDate),
								},
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
