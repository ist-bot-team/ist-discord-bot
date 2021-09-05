// Misc. logic that doesn't fit elsewhere

import * as Discord from "discord.js";
import * as Builders from "@discordjs/builders";

import { CommandDescriptor } from "../bot.d";
import { PrismaClient } from "@prisma/client";

export function provideCommands(): CommandDescriptor[] {
	return [
		{
			command: "about",
			builder: new Builders.SlashCommandBuilder()
				.setName("about")
				.setDescription("Show general and version information"),
			handler: handleAboutCommand,
		},
	];
}

export async function handleAboutCommand(
	interaction: Discord.CommandInteraction,
	_prisma: PrismaClient,
	client: Discord.Client
): Promise<void> {
	const pvar = (v: string, fallback = "[unknown]") =>
		process.env["npm_package_" + v] ?? fallback;
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
				.setFooter("Uptime: " + client.uptime),
		],
	});
}
