import { PrismaClient } from "@prisma/client";

import * as Discord from "discord.js";
import * as Builders from "@discordjs/builders";

import { CommandDescriptor } from "../bot.d";

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
	//
}
