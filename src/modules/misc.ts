// Misc. logic that doesn't fit elsewhere

import * as fs from "fs";

import * as Discord from "discord.js";
import * as Builders from "@discordjs/builders";

import { CommandDescriptor } from "../bot.d";
import { CommandPermission } from "../bot";
import * as utils from "./utils";
import { SlashCommandBuilder } from "@discordjs/builders";

export function provideCommands(): CommandDescriptor[] {
	const say = new Builders.SlashCommandBuilder()
		.setName("say")
		.setDescription("Sends a message to a channel");
	say.addStringOption(
		new Builders.SlashCommandStringOption()
			.setName("message")
			.setDescription("What message to send")
			.setRequired(true)
	);
	say.addChannelOption(
		new Builders.SlashCommandChannelOption()
			.setName("channel")
			.setDescription("Where to send the message; defaults to current")
			.setRequired(false)
	);
	say.addBooleanOption(
		new Builders.SlashCommandBooleanOption()
			.setName("allow-mentions")
			.setDescription(
				"Whether to allow mentions in the message; defaults to false"
			)
			.setRequired(false)
	);
	const whoSaid = new SlashCommandBuilder()
		.setName("who-said")
		.setDescription("Shows who ordered the bot to say something");
	whoSaid.addStringOption(
		new Builders.SlashCommandStringOption()
			.setName("message-id")
			.setDescription("Message ID in question")
			.setRequired(true)
	);
	return [
		{
			builder: new Builders.SlashCommandBuilder()
				.setName("about")
				.setDescription("Show general and version information"),
			handler: handleAboutCommand,
			permission: CommandPermission.Public,
		},
		{
			builder: say,
			handler: handleSayCommand,
		},
		{
			builder: whoSaid,
			handler: handleWhoSaidCommand,
		},
	];
}

export async function handleAboutCommand(
	interaction: Discord.CommandInteraction
): Promise<void> {
	let pkg: Record<string, string>;
	try {
		pkg = JSON.parse(
			fs.readFileSync(__dirname + "/../../package.json").toString()
		);
	} catch (e) {
		pkg = {};
	}
	const pvar = (v: string, fallback = "[unknown]") => pkg[v] ?? fallback;

	// cannot easily import so reading it directly
	await interaction.editReply({
		embeds: [
			new Discord.MessageEmbed()
				.setTitle("IST Discord Bot")
				.setURL(pvar("homepage", "https://discord.leic.pt"))
				.setAuthor(pvar("author"))
				.setDescription(
					`**Description:** ${pvar("description")}
				**Version:** ${pvar("version")}
				**License:** ${pvar("license")}
				**Authors:**`
				)
				.addFields(
					[
						["Rafael Oliveira", "RafDevX"],
						["Diogo Correia", "diogotcorreia"],
						["Luís Fonseca", "luishfonseca"],
					].map((a) => ({
						name: a[0],
						value: "[GitHub](https://github.com/" + a[1] + ")",
						inline: true,
					}))
				)
				.setFooter(
					"Uptime: " +
						utils.durationString(interaction.client.uptime ?? 0)
				),
		],
	});
}

const sayLogs: Discord.Collection<string, string> = new Discord.Collection();

export async function handleSayCommand(
	interaction: Discord.CommandInteraction
): Promise<void> {
	try {
		const channel = (interaction.options.getChannel("channel", false) ||
			interaction.channel) as Discord.GuildChannel | null;
		const message = interaction.options.getString("message", true);
		const allowMentions =
			interaction.options.getBoolean("allow-mentions", false) ?? false;

		if (channel && channel.isText()) {
			const msg = await channel.send({
				content: message.replace(/\\n/g, "\n"),
				allowedMentions: allowMentions ? undefined : { parse: [] },
			});
			const uid = interaction.member?.user.id;
			if (uid) {
				sayLogs.set(msg.id, uid);
				console.log(
					`User ${
						interaction.member?.user.username
					} said «${message}» (w/${
						allowMentions ? "" : "o"
					} mentions)`
				);
			}
			await interaction.editReply(
				utils.CheckMarkEmoji + "Successfully sent message."
			);
			return;
		}
		throw new Error("???");
	} catch (e) {
		await interaction.editReply(utils.XEmoji + "Something went wrong.");
	}
}

export async function handleWhoSaidCommand(
	interaction: Discord.CommandInteraction
): Promise<void> {
	try {
		const messageId = interaction.options.getString("message-id", true);
		const split = messageId.split("-");
		const who = sayLogs.get(split[split.length - 1]);

		if (who) {
			await interaction.editReply(`<@${who}> said it!`);
		} else {
			await interaction.editReply("I don't know who said it...");
		}
	} catch (e) {
		await interaction.editReply(
			utils.XEmoji + "Something went wrong, maybe wrong message ID?"
		);
	}
}
