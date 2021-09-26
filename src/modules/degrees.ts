import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";

import * as Discord from "discord.js";
import * as Builders from "@discordjs/builders";

import { CommandDescriptor } from "../bot.d";
import * as utils from "./utils";
import * as fenix from "./fenix";

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

export function provideCommands(): CommandDescriptor[] {
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

export async function createDegree(
	prisma: PrismaClient,
	guild: Discord.Guild,
	acronym: string,
	role: Discord.Role,
	tier: number,
	fenixAcronym: string | null,
	degreeTextChannel: Discord.GuildChannel | null,
	degreeVoiceChannel: Discord.GuildChannel | null,
	courseSelectionChannel: Discord.GuildChannel | null,
	announcementsChannel: Discord.GuildChannel | null
): Promise<true | string> {
	if (!tierChoices.map((arr) => arr[1]).includes(tier.toString())) {
		return "Invalid tier";
	}

	if (!fenixAcronym) fenixAcronym = acronym;

	const degrees = await fenix.getDegrees();
	const shortDegree = degrees.filter(
		(d) => d.acronym.toLowerCase() === fenixAcronym?.toLowerCase()
	)[0];

	if (shortDegree === undefined) {
		return "Could not find degree; try setting a fenix-acronym";
	}

	const reason = "Adding new degree " + acronym;

	if (tier >= 1) {
		const catName = role.name.toUpperCase();
		const category =
			(
				degreeTextChannel ??
				degreeVoiceChannel ??
				courseSelectionChannel ??
				announcementsChannel
			)?.parent ??
			((await guild.channels.fetch())
				.filter(
					(c) => c.type === "GUILD_CATEGORY" && c.name === catName
				)
				.first() as Discord.CategoryChannel | undefined) ??
			(await guild.channels.create(catName, {
				type: "GUILD_CATEGORY",
				permissionOverwrites: [
					{
						id: guild.roles.everyone.id,
						deny: [Discord.Permissions.FLAGS.VIEW_CHANNEL],
					},
					{
						id: role.id,
						allow: [Discord.Permissions.FLAGS.VIEW_CHANNEL],
					},
				],
				reason,
			}));
		if (!degreeTextChannel) {
			degreeTextChannel = await guild.channels.create(
				acronym.toLowerCase(),
				{
					type: "GUILD_TEXT",
					topic: shortDegree.name,
					parent: category,
					reason,
				}
			);
			await degreeTextChannel.lockPermissions();
		}
		if (!degreeVoiceChannel) {
			degreeVoiceChannel = await guild.channels.create(
				acronym.toUpperCase(),
				{
					type: "GUILD_VOICE",
					parent: category,
					reason,
				}
			);
			await degreeVoiceChannel.lockPermissions();
		}
	}

	await prisma.degree.create({
		data: {
			fenixId: shortDegree.id,
			acronym,
			name: shortDegree.name,
			roleId: role.id,
			tier,
			degreeTextChannelId: degreeTextChannel
				? degreeTextChannel.id
				: null,
			degreeVoiceChannelId: degreeVoiceChannel
				? degreeVoiceChannel.id
				: null,
			announcementsChannelId: announcementsChannel
				? announcementsChannel.id
				: null,
			courseSelectionChannelId: courseSelectionChannel
				? courseSelectionChannel.id
				: null,
		},
	});

	return true;
}

export async function handleCommand(
	interaction: Discord.CommandInteraction,
	prisma: PrismaClient
): Promise<void> {
	if (!interaction.guild) return;

	switch (interaction.options.getSubcommand()) {
		case "create": {
			try {
				const result = await createDegree(
					prisma,
					interaction.guild,
					interaction.options.getString("acronym", true),
					interaction.options.getRole("role", true) as Discord.Role,
					parseInt(interaction.options.getString("tier", true)),
					interaction.options.getString("fenix-acronym", false),
					interaction.options.getChannel(
						"degree-text-channel",
						false
					) as Discord.GuildChannel | null,
					interaction.options.getChannel(
						"degree-voice-channel",
						false
					) as Discord.GuildChannel | null,
					interaction.options.getChannel(
						"course-selection-channel",
						false
					) as Discord.GuildChannel | null,
					interaction.options.getChannel(
						"announcements-channel",
						false
					) as Discord.GuildChannel | null
				);
				if (result === true) {
					await interaction.editReply(
						utils.CheckMarkEmoji + "Sucessfully created degree."
					);
				} else {
					await interaction.editReply(utils.XEmoji + result);
				}
			} catch (e) {
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}

			break;
		}
		case "delete": {
			try {
				const acronym = interaction.options.getString("acronym", true);
			} catch (e) {
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}

			break;
		}
		case "rename": {
			try {
				const acronym = interaction.options.getString("acronym", true);
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
				const acronym = interaction.options.getString("acronym", true);
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
				const acronym = interaction.options.getString("acronym", true);
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
				const acronym = interaction.options.getString("acronym", true);
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
