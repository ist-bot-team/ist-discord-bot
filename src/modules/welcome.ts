// Send welcome message to new users

import { PrismaClient } from "@prisma/client";
import * as Discord from "discord.js";
import * as Builders from "@discordjs/builders";

import { CommandDescriptor } from "../bot.d";
import * as utils from "./utils";

async function getWelcomeChannel(
	prisma: PrismaClient,
	client: Discord.Client
): Promise<Discord.TextChannel | null> {
	const id = (
		await prisma.config.findFirst({
			where: { key: "welcome:channel_id" },
		})
	)?.value;
	if (id === undefined) {
		return null;
	}
	return (await client.channels.fetch(id)) as Discord.TextChannel | null;
}

export async function handleGuildJoin(
	member: Discord.GuildMember,
	prisma: PrismaClient
): Promise<void> {
	const channel = await getWelcomeChannel(prisma, member.client);
	const message = (
		await prisma.config.findFirst({ where: { key: "welcome:message" } })
	)?.value;
	if (channel !== null && message != undefined) {
		channel.send(message.replace(/\$USER/g, member.user.toString()));
	}
}

export function provideCommands(): CommandDescriptor[] {
	const cmd = new Builders.SlashCommandBuilder()
		.setName("welcome")
		.setDescription("Send a welcome message when someone joins the server");
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("set-channel")
			.setDescription("Set where messages will be sent")
			.addChannelOption(
				new Builders.SlashCommandChannelOption()
					.setName("channel")
					.setDescription("Where welcome messages will be sent")
					.setRequired(true)
			)
	);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("set-message")
			.setDescription("Set which message will be sent when someone joins")
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("message")
					.setDescription(
						"Message that will be sent; use $USER to tag the new member"
					)
					.setRequired(true)
			)
	);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("view")
			.setDescription("View welcome message settings")
	);
	return [{ builder: cmd, handler: handleCommand }];
}

export async function handleCommand(
	interaction: Discord.CommandInteraction,
	prisma: PrismaClient
): Promise<void> {
	try {
		switch (interaction.options.getSubcommand()) {
			case "set-channel": {
				const channel = interaction.options.getChannel(
					"channel",
					true
				) as Discord.GuildChannel;
				if (!channel.isText()) {
					await interaction.editReply(
						utils.XEmoji + "Channel must be a text channel."
					);
				} else {
					await prisma.config.upsert({
						where: { key: "welcome:channel_id" },
						update: { value: channel.id },
						create: {
							key: "welcome:channel_id",
							value: channel.id,
						},
					});
					await interaction.editReply(
						utils.CheckMarkEmoji +
							`Welcome channel successfully set as <#${channel.id}>.`
					);
				}
				break;
			}
			case "set-message": {
				const message = interaction.options.getString("message", true);
				const value = message.replace(/\\n/g, "\n");
				await prisma.config.upsert({
					where: { key: "welcome:message" },
					update: { value },
					create: { key: "welcome:message", value },
				});
				await interaction.editReply(
					utils.CheckMarkEmoji + `Welcome message successfully set.`
				);
				break;
			}
			case "view": {
				const getSetting = async (s: string) =>
					(
						await prisma.config.findFirst({
							where: { key: `welcome:${s}` },
						})
					)?.value;
				const message = (await getSetting("message")) ?? "[NONE]";
				const channelId = await getSetting("channel");
				const channel = channelId ? `<#${channelId}>` : "[NONE]";
				await interaction.editReply({
					embeds: [
						new Discord.MessageEmbed()
							.setTitle("Welcome Message Settings")
							.setDescription(`**Message:** ${message}`)
							.addField("Channel", channel, true),
					],
				});
				break;
			}
		}
	} catch (e) {
		await interaction.editReply(utils.XEmoji + "Something went wrong.");
	}
}
