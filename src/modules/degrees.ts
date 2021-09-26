import { PrismaClient } from "@prisma/client";

import * as Discord from "discord.js";
import * as Builders from "@discordjs/builders";

import { CommandDescriptor } from "../bot.d";
import * as utils from "./utils";

export function provideCommands(): CommandDescriptor[] {
	const tierChoices = [
		"None",
		"Degree channels (Text & VC)",
		"1 + Course channels (& course selection channel)",
		"2 + Announcements channel",
	].map(
		(desc, i) =>
			[`${i}: ${i > 1 ? i - 1 + " + " : ""}${desc}`, i.toString()] as [
				name: string,
				value: string
			]
	);
	const cmd = new Builders.SlashCommandBuilder()
		.setName("degrees")
		.setDescription("Manage degrees");
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("create")
			.setDescription("Create a new degree")
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("acronym")
					.setDescription("Degree acronym")
					.setRequired(true)
			)
			.addRoleOption(
				new Builders.SlashCommandRoleOption()
					.setName("role")
					.setDescription("Degree role")
					.setRequired(true)
			)
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("tier")
					.setDescription("Degree tier within the server")
					.setRequired(true)
					.addChoices(tierChoices)
			)
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("fenix-acronym")
					.setDescription(
						"Acronym used by Fénix, if different than normal acronym"
					)
					.setRequired(false)
			)
			.addChannelOption(
				new Builders.SlashCommandChannelOption()
					.setName("degree-text-channel")
					.setDescription("Use an existing degree text channel")
					.setRequired(false)
			)
			.addChannelOption(
				new Builders.SlashCommandChannelOption()
					.setName("degree-voice-channel")
					.setDescription("Use an existing degree voice channel")
					.setRequired(false)
			)
			.addChannelOption(
				new Builders.SlashCommandChannelOption()
					.setName("course-selection-channel")
					.setDescription("Use an existing course selection channel")
					.setRequired(false)
			)
			.addChannelOption(
				new Builders.SlashCommandChannelOption()
					.setName("announcements-channel")
					.setDescription("Use an existing announcements channel")
					.setRequired(false)
			)
	);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("delete")
			.setDescription(
				"Remove a degree (no channels/roles will be deleted)"
			)
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("acronym")
					.setRequired(true)
			)
	);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("rename")
			.setDescription("Rename an existing degree")
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("acronym")
					.setDescription("Course acronym")
					.setRequired(true)
			)
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("new-name")
					.setDescription("What to change the name to")
					.setRequired(true)
			)
	);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("set-role")
			.setDescription("Set the role associated with an existing degree")
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("acronym")
					.setDescription("The degree's acronym")
					.setRequired(true)
			)
			.addRoleOption(
				new Builders.SlashCommandRoleOption()
					.setName("new-role")
					.setDescription("What role to set")
					.setRequired(true)
			)
	);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("set-tier")
			.setDescription("Set the tier associated with an existing degree")
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("acronym")
					.setDescription("The degree's acronym")
					.setRequired(true)
			)
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("new-tier")
					.setDescription("What tier to set")
					.setRequired(true)
					.addChoices(tierChoices)
			)
	);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("set-channel")
			.setDescription("Set a channel associated with an existing degree")
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("acronym")
					.setDescription("The degree's acronym")
					.setRequired(true)
			)
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("channel-type")
					.setDescription("What type channel to set")
					.setRequired(true)
					.addChoice("Degree Text", "degree-text")
					.addChoice("Degree Voice", "degree-voice")
					.addChoice("Announcements", "announcements")
					.addChoice("Course Selection", "course-selection")
			)
	);
	return [{ builder: cmd, handler: handleCommand }];
}

export async function handleCommand(
	interaction: Discord.CommandInteraction,
	prisma: PrismaClient
): Promise<void> {
	switch (interaction.options.getSubcommand()) {
		case "create": {
			try {
				//FIXME: Assuming acronym = name and fenix-acronym = acronym. Please check!
				const name = interaction.options.getString("acronym", true);
				const role = interaction.options.getRole("role", true);
				const tier = interaction.options.getString("tier", true);
				const acronym = interaction.options.getString(
					"fenix-acronym",
					false
				);
				const degreeTextChannel = interaction.options.getChannel(
					"degree-text-channel",
					false
				);
				const degreeVoiceChannel = interaction.options.getChannel(
					"degree-voice-channel",
					false
				);
				const courseSelectionChannel = interaction.options.getChannel(
					"course-selection-channel",
					false
				);
				const announcementsChannel = interaction.options.getChannel(
					"announcements-channel",
					false
				);
			} catch (e) {
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}

			break;
		}
		case "delete": {
			try {
				const name = interaction.options.getString("acronym", true);
			} catch (e) {
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}

			break;
		}
		case "rename": {
			try {
				const name = interaction.options.getString("acronym", true);
				const newName = interaction.options.getString("new-name", true);
			} catch (e) {
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}

			break;
		}
		case "set-role": {
			try {
				const name = interaction.options.getString("acronym", true);
				const newRole = interaction.options.getRole("new-role", true);
			} catch (e) {
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}

			break;
		}
		case "set-tier": {
			try {
				const name = interaction.options.getString("acronym", true);
				const newTier = interaction.options.getString("new-tier", true);
			} catch (e) {
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}

			break;
		}
		case "set-channel": {
			try {
				const name = interaction.options.getString("acronym", true);
				const channelType = interaction.options.getString(
					"channel-type",
					true
				);
			} catch (e) {
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}

			break;
		}
	}
}
