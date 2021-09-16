// Misc. logic that doesn't fit elsewhere

import * as fs from "fs";

import * as Discord from "discord.js";
import * as Builders from "@discordjs/builders";

import { CommandDescriptor } from "../bot.d";
import { CommandPermission } from "../bot";
import * as utils from "./utils";

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
			await channel.send({
				content: message.replace(/\\n/g, "\n"),
				allowedMentions: allowMentions ? undefined : { parse: [] },
			});
			await interaction.editReply("✅ Successfully sent message.");
			return;
		}
		throw new Error("???");
	} catch (e) {
		await interaction.editReply("❌ Something went wrong.");
	}
}
