import * as Discord from "discord.js";
import * as Builders from "@discordjs/builders";

import { CommandDescriptor } from "../bot.d";
import { SlashCommandSubcommandBuilder } from "@discordjs/builders";

const MAX_PEOPLE = 50;

type UsersCharacterCount = Discord.Collection<Discord.Snowflake, number>;

export async function getUsersCharacterCount(
	guild: Discord.Guild
): Promise<[UsersCharacterCount, number, number, Discord.Channel[]]> {
	// TODO: checkpoint
	// TODO: just last 30 days

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
				chars.set(
					msg.author.id,
					(chars.get(msg.author.id) ?? 0) + msg.content.length
				);
				msgCount++;
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
	sendChannel: Discord.TextChannel | Discord.ThreadChannel
): Promise<[number, number, Discord.Channel[]]> {
	const [chars, channels, msgs, failed] = await getUsersCharacterCount(
		sendChannel.guild
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

	lines.unshift("**__LEADERBOARD__** *(por número de caracteres)*");

	sendChannel.send(lines.join("\n"));

	return [channels, msgs, failed];
}

export function provideCommands(): CommandDescriptor[] {
	const cmd = new Builders.SlashCommandBuilder()
		.setName("leaderboard")
		.setDescription(
			"Manage leaderboard that sorts server members by characters sent"
		);
	cmd.addSubcommand(
		new SlashCommandSubcommandBuilder()
			.setName("send")
			.setDescription("Calculate and send a new leaderboard")
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
				await sendLeaderboard(
					interaction.channel as
						| Discord.TextChannel
						| Discord.ThreadChannel
				);
			} catch (e) {
				await interaction.editReply("❌ Something went wrong.");
			}
			break;
		}
	}
}
