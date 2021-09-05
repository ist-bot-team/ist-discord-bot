// Misc. logic that doesn't fit elsewhere

import * as fs from "fs";

import * as Discord from "discord.js";
import * as Builders from "@discordjs/builders";

import { PrismaClient } from "@prisma/client";

import { CommandDescriptor } from "../bot.d";
import { CommandPermission } from "../bot";
import * as utils from "./utils";

export function provideCommands(): CommandDescriptor[] {
	return [
		{
			builder: new Builders.SlashCommandBuilder()
				.setName("about")
				.setDescription("Show general and version information"),
			handler: handleAboutCommand,
			permission: CommandPermission.Public,
		},
	];
}

export async function handleAboutCommand(
	interaction: Discord.CommandInteraction,
	_prisma: PrismaClient,
	client: Discord.Client
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
					"Uptime: " + utils.durationString(client.uptime ?? 0)
				),
		],
	});
}
