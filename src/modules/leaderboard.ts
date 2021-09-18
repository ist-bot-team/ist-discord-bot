import * as Discord from "discord.js";
import * as Builders from "@discordjs/builders";

import { CommandDescriptor } from "../bot.d";

import * as utils from "./utils";

const MAX_PEOPLE = 50;

type UsersCharacterCount = Discord.Collection<Discord.Snowflake, number>;

export async function getUsersCharacterCount(
	guild: Discord.Guild,
	onlyCountAfter?: Date
): Promise<[UsersCharacterCount, number, number, Discord.Channel[]]> {
	// TODO: checkpoint

	const chars: UsersCharacterCount = new Discord.Collection();
	const failed: (Discord.TextChannel | Discord.ThreadChannel)[] = [];
	let msgCount = 0;

	const channels = Array.from(
		(await guild.channels.fetch()).filter(
			(channel) => channel.isText() || channel.isThread()
		)
	).map((o) => o[1]) as (Discord.TextChannel | Discord.ThreadChannel)[];
	const promises = channels.map(async (channel) => {
		const messages = await channel.messages.fetch();
		for (const [_id, msg] of messages) {
			if (!msg.deleted && msg.author && !msg.author.bot) {
				if (
					onlyCountAfter === undefined ||
					(msg.editedAt ?? msg.createdAt) >= onlyCountAfter
				) {
					chars.set(
						msg.author.id,
						(chars.get(msg.author.id) ?? 0) + msg.content.length
					);
					msgCount++;
				} else {
					// ? FIXME: TODO: !!! SHOULD A BREAK BE HERE?
					// * would really help efficiency but I don't know if messages are sorted
					// * either way recently edited messages wouldn't be counted
				}
			}
		}
	});

	(await Promise.allSettled(promises)).map((res, i) => {
		if (res.status === "rejected") {
			failed.push(channels[i]);
		}
	});

	return [chars, channels.length, msgCount, failed];
}

export async function sendLeaderboard(
	sendChannel: Discord.TextChannel | Discord.ThreadChannel,
	period: string
): Promise<[number, number, Discord.Channel[], Discord.Snowflake]> {
	const now = new Date().getTime();
	const day = 1000 * 60 * 60 * 24;

	const [chars, channels, msgs, failed] = await getUsersCharacterCount(
		sendChannel.guild,
		period === "month"
			? new Date(now - 30 * day)
			: period === "week"
			? new Date(now - 7 * day)
			: undefined
	);

	chars.sort((v1, v2, k1, k2) => v2 - v1 || parseInt(k1) - parseInt(k2));

	const lines = [];

	for (const [uid, cs] of chars) {
		if (lines.length > MAX_PEOPLE) break;
		lines.push(
			`\`#${(lines.length + 1)
				.toString()
				.padStart(
					Math.ceil(Math.log10(MAX_PEOPLE)),
					"0"
				)}\` <@${uid}> (${cs})`
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

	return [channels, msgs, failed, sent.id];
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
					.addChoice("All messages", "all")
					.addChoice("Last 30 days", "month")
					.addChoice("Last 7 days", "week")
			)
	);
	return [
		{
			builder: cmd,
			handler: handleCommand,
		},
	];
}

export async function handleCommand(
	interaction: Discord.CommandInteraction
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

				const [delta, [channels, msgs, failed, msgId]] =
					(await utils.timeFunction(
						async () =>
							await sendLeaderboard(
								interaction.channel as
									| Discord.TextChannel
									| Discord.ThreadChannel,
								period
							)
					)) as [
						number,
						utils.ThenArg<ReturnType<typeof sendLeaderboard>>
					];
				await interaction.editReply(`✅ Sent [here](https://discord.com/channels/${
					interaction.guildId as string
				}/${interaction.channelId as string}/${msgId})

Took ${delta}ms, combed through ${channels} channels and ${msgs} messages.
${
	failed.length
		? "❌ Failed to go through the following channels: " +
		  failed.map((c) => "<#" + c.id + ">").join(", ")
		: "Did not fail to go through any channel"
}`);
				// TODO: if any failed, say I can't cache it (whenever I do start caching it with checkpoints)
			} catch (e) {
				await interaction.editReply("❌ Something went wrong.");
			}
			break;
		}
	}
}
