// Guild leaderboard of users sorted by characters sent

import { PrismaClient, LeaderboardEntry } from "@prisma/client";

import * as Discord from "discord.js";
import * as Builders from "@discordjs/builders";

import { CommandDescriptor } from "../bot.d";

import * as utils from "./utils";
import { ThenArg } from "./utils.d";
import logger from "../logger";

const MAX_PEOPLE = 50;

type UsersCharacterCount = Discord.Collection<Discord.Snowflake, number>;

export async function getUsersCharacterCount(
	guild: Discord.Guild,
	onlyCountAfter?: Date,
	cacheDate?: Date
): Promise<
	[
		UsersCharacterCount,
		number,
		number,
		Discord.BaseChannel[],
		UsersCharacterCount
	]
> {
	const chars: UsersCharacterCount = new Discord.Collection();
	const addToCache: UsersCharacterCount = new Discord.Collection();
	const failed: (Discord.TextChannel | Discord.ThreadChannel)[] = [];
	let msgCount = 0;

	const channels = Array.from(
		(await guild.channels.fetch()).filter(
			(channel) => channel.isTextBased() || channel.isThread()
		)
	).map((o) => o[1]) as (Discord.TextChannel | Discord.ThreadChannel)[];
	const promises = channels.map(async (channel) => {
		const messages = await utils.fetchAllChannelMessages(channel);
		for (const [_id, msg] of messages) {
			if (msg.author && !msg.author.bot) {
				if (
					onlyCountAfter === undefined ||
					msg.createdAt > onlyCountAfter
				) {
					const delta = msg.content.replace(
						/[^\p{Letter}\p{Number}\p{Punctuation}]/gu,
						""
					).length;
					chars.set(
						msg.author.id,
						(chars.get(msg.author.id) ?? 0) + delta
					);
					msgCount++;

					if (cacheDate && msg.createdAt <= cacheDate) {
						addToCache.set(
							msg.author.id,
							(addToCache.get(msg.author.id) ?? 0) + delta
						);
					}
				} else {
					break; // counting on you to be ordered, discord!
				}
			}
		}
	});

	(await Promise.allSettled(promises)).map((res, i) => {
		if (res.status === "rejected") {
			failed.push(channels[i]);
		}
	});

	return [chars, channels.length, msgCount, failed, addToCache];
}

export async function sendLeaderboard(
	sendChannel: Discord.TextChannel | Discord.ThreadChannel,
	period: string,
	prisma: PrismaClient
): Promise<[number, number, Discord.BaseChannel[], number, Discord.Snowflake]> {
	const now = new Date().getTime();
	const day = 1000 * 60 * 60 * 24;

	const cacheStamp = ((i) => (i !== undefined ? new Date(i) : i))(
		(
			await prisma.config.findFirst({
				where: { key: "leaderboard:cache_stamp" },
			})
		)?.value
	);
	const cache = cacheStamp ? await prisma.leaderboardEntry.findMany() : [];

	const cacheDate = new Date(now - 45 * day); // cache messages older than 45 days

	const [chars, channels, msgs, failed, addToCache] =
		await getUsersCharacterCount(
			sendChannel.guild,
			period === "month"
				? new Date(now - 30 * day)
				: period === "week"
				? new Date(now - 7 * day)
				: cacheStamp
				? new Date(cacheStamp)
				: undefined,
			cacheDate
		);

	const cacheMap: { [uid: string]: LeaderboardEntry } = {};

	for (const entry of cache) {
		cacheMap[entry.userId] = entry;

		chars.set(
			entry.userId,
			(chars.get(entry.userId) ?? 0) + entry.characterCount
		);
	}

	if (!failed.length) {
		for (const [uid, count] of addToCache) {
			const entry = cacheMap[uid];
			if (entry) {
				entry.characterCount += count;
			} else {
				cache.push({ userId: uid, characterCount: count });
			}
		}

		await prisma.$transaction([
			prisma.config.upsert({
				where: { key: "leaderboard:cache_stamp" },
				update: { value: cacheDate.toISOString() },
				create: {
					key: "leaderboard:cache_stamp",
					value: cacheDate.toISOString(),
				},
			}),
			...cache.map((entry) =>
				prisma.leaderboardEntry.upsert({
					where: { userId: entry.userId },
					update: { characterCount: entry.characterCount },
					create: {
						userId: entry.userId,
						characterCount: entry.characterCount,
					},
				})
			),
		]);
	}

	chars.sort((v1, v2, k1, k2) =>
		v1 !== v2 ? v2 - v1 : parseInt(k2) - parseInt(k1)
	);

	const lines = [];

	for (const [uid, cs] of chars) {
		if (lines.length > MAX_PEOPLE) break;
		let label = uid;
		try {
			try {
				const member = await sendChannel.guild.members.fetch(uid);
				label = member.toString();
			} catch (e) {
				const user = await sendChannel.client.users.fetch(uid);
				label = user.tag;
			}
		} catch (e) {
			// do nothing
		}
		lines.push(
			`\`#${(lines.length + 1)
				.toString()
				.padStart(
					Math.ceil(Math.log10(MAX_PEOPLE)),
					"0"
				)}\` ${label} (${cs})`
		);
	}

	lines.unshift(
		"**__LEADERBOARD__** *(by character count)* `[" +
			period.toUpperCase() +
			"]`"
	);

	const sent = await sendChannel.send({
		content: lines.join("\n"),
		allowedMentions: { parse: [] },
	});

	return [
		channels,
		msgs,
		failed,
		failed.length ? 0 : addToCache.reduce((a, b) => a + b, 0),
		sent.id,
	];
}

export function provideCommands(): CommandDescriptor[] {
	const cmd = new Builders.SlashCommandBuilder()
		.setName("leaderboard")
		.setDescription(
			"Manage leaderboard that sorts server members by characters sent"
		);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("send")
			.setDescription("Calculate and send a new leaderboard")
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("time-period")
					.setDescription(
						"How recent do messages have to be to be considered; defaults to all"
					)
					.setRequired(false)
					.addChoices({ name: "All messages", value: "all" })
					.addChoices({ name: "Last 30 days", value: "month" })
					.addChoices({ name: "Last 7 days", value: "week" })
			)
	);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("clear-cache")
			.setDescription("Clear existing message cache")
	);
	return [
		{
			builder: cmd,
			handler: handleCommand,
		},
	];
}

export async function handleCommand(
	interaction: Discord.ChatInputCommandInteraction,
	prisma: PrismaClient
): Promise<void> {
	switch (interaction.options.getSubcommand()) {
		case "send": {
			try {
				if (!interaction.channel) {
					throw new Error("Channel must exist");
				}
				// TODO: if one is already being sent, don't allow another user to run command
				const period =
					interaction.options.getString("time-period", false) ??
					"all";
				await interaction.editReply(
					`Will send a leaderboard (period: ${period}) to ${interaction.channel}, but calculations are necessary.\nThis may take a while...`
				);

				const [delta, [channels, msgs, failed, cached, msgId]] =
					(await utils.timeFunction(
						async () =>
							await sendLeaderboard(
								interaction.channel as
									| Discord.TextChannel
									| Discord.ThreadChannel,
								period,
								prisma
							)
					)) as [number, ThenArg<ReturnType<typeof sendLeaderboard>>];
				await interaction.editReply(
					utils.CheckMarkEmoji +
						`Sent [here](https://discord.com/channels/${
							interaction.guildId as string
						}/${interaction.channelId as string}/${msgId})

Took ${delta}ms, combed through ${channels} channels and ${msgs} messages.
${
	failed.length
		? utils.XEmoji +
		  "Failed to go through the following channels: " +
		  failed.map((c) => "<#" + c.id + ">").join(", ") +
		  "; as such, did not cache anything"
		: "Did not fail to go through any channel; cached " +
		  cached +
		  " characters"
}`
				);
			} catch (e) {
				await interaction
					.editReply(utils.XEmoji + "Something went wrong.")
					.catch(() => logger.error("Leaderboard took too long :("));
			}
			break;
		}
		case "clear-cache": {
			try {
				await prisma.leaderboardEntry.deleteMany(); // CAREFUL! deletes everything!
				const stamp = (
					await prisma.config.delete({
						where: { key: "leaderboard:cache_stamp" },
					})
				).value;
				await interaction.editReply(
					utils.CheckMarkEmoji +
						`Successfully reset cache; last stamp was ${stamp}`
				);
			} catch (e) {
				logger.error(e, "Error while crearing cache of leaderboard");
				await interaction.editReply(
					utils.XEmoji +
						"Something went wrong, maybe there was no cache?"
				);
			}
			break;
		}
	}
}
