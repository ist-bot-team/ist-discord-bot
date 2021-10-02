import { PrismaClient } from "@prisma/client";

import * as Discord from "discord.js";
import * as Builders from "@discordjs/builders";

import { CommandDescriptor } from "../bot.d";
import * as utils from "./utils";
import * as fenix from "./fenix";
import * as courses from "./courses";
import { OrphanChannel } from "./courses.d";

const tierChoices = [
	"None",
	"Degree channels (Text & VC)",
	"Course channels (& course selection channel)",
	"Announcements channel",
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
			.setName("list")
			.setDescription("List all degrees")
	);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("view")
			.setDescription("Show information relative to a degree")
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("acronym")
					.setDescription("The acronym of the degree to be removed")
					.setRequired(true)
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
					.setDescription("The acronym of the degree to be removed")
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
			.addChannelOption(
				new Builders.SlashCommandChannelOption()
					.setName("new-channel")
					.setDescription("New channel to set")
					.setRequired(true)
			)
	);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("refresh-courses")
			.setDescription("Refresh degree courses from Fenix")
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("acronym")
					.setDescription("The acronym of the degree to refresh")
					.setRequired(true)
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
): Promise<OrphanChannel[] | string> {
	// snowflakes are orphan channels; FIXME: change to course.OrphanChannel[]
	if (!tierChoices.map((arr) => arr[1]).includes(tier.toString())) {
		return "Invalid tier";
	}

	if (!fenixAcronym) fenixAcronym = acronym;

	const degrees = await fenix.getDegrees();
	const shortDegree = degrees.find(
		(d) => d.acronym.toLowerCase() === fenixAcronym?.toLowerCase()
	);

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

		if (tier >= 2) {
			const restricted = [
				{
					id: guild.roles.everyone,
					deny: [
						Discord.Permissions.FLAGS.VIEW_CHANNEL,
						Discord.Permissions.FLAGS.SEND_MESSAGES,
					],
				},
				{
					id: role.id,
					allow: [Discord.Permissions.FLAGS.VIEW_CHANNEL],
				},
			];

			if (!courseSelectionChannel) {
				courseSelectionChannel = await guild.channels.create(
					acronym.toLowerCase() + "-cadeiras",
					{
						type: "GUILD_TEXT",
						topic: "Selecionar cadeiras",
						parent: category,
						reason,
						permissionOverwrites: restricted,
					}
				);
			}

			if (tier >= 3) {
				if (!announcementsChannel) {
					const announcer = (await guild.roles.fetch())
						.filter((r) => r.name === "Announcer")
						.first();
					announcementsChannel = await guild.channels.create(
						acronym.toLowerCase() + "-announcements",
						{
							type: "GUILD_TEXT",
							topic: shortDegree.name + " Announcements",
							parent: category,
							reason,
							permissionOverwrites: announcer
								? restricted.concat({
										id: announcer.id,
										allow: [
											Discord.Permissions.FLAGS
												.SEND_MESSAGES,
										],
								  })
								: restricted,
						}
					);
				}
			}
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

	await courses.importCoursesFromDegree(prisma, shortDegree.id);

	return await courses.refreshCourses(prisma, guild);
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
				if (typeof result === "string") {
					await interaction.editReply(utils.XEmoji + result);
				} else {
					await interaction.editReply(
						utils.CheckMarkEmoji +
							"Sucessfully created degree." +
							(result.length
								? `\nConsider deleting the following ${result.length} orphan channel(s):\n` +
								  result.map((c) => `- <#${c.id}>`).join("\n")
								: "")
					);
				}
			} catch (e) {
				console.error(e);
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}

			break;
		}
		case "list": {
			try {
				const degrees = await prisma.degree.findMany();

				await interaction.editReply({
					embeds: [
						new Discord.MessageEmbed()
							.setTitle("All Degrees")
							.setDescription(
								"Below are all known degrees, by acronym and Fénix ID"
							)
							.addFields(
								degrees.map((d) => ({
									name: d.acronym,
									value: d.fenixId,
									inline: true,
								}))
							),
					],
				});
			} catch (e) {
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}

			break;
		}
		case "view": {
			try {
				const acronym = interaction.options.getString("acronym", true);

				const degree = await prisma.degree.findFirst({
					where: { acronym },
				});

				if (degree === null) {
					await interaction.editReply(
						utils.XEmoji + "Could not find degree"
					);
				} else {
					await interaction.editReply({
						embeds: [
							new Discord.MessageEmbed()
								.setTitle("Degree Information")
								.setDescription(
									"Below are all the available details on this degree."
								)
								.addField("Acronym", degree.acronym, true)
								.addField("Name", degree.name, true)
								.addField("Fénix ID", degree.fenixId, true)
								.addField("Tier", degree.tier.toString(), true)
								.addField("Role", `<@&${degree.roleId}>`, true)
								.addField(
									"Text Channel",
									degree.degreeTextChannelId
										? `<#${degree.degreeTextChannelId}>`
										: "[NOT SET]",
									true
								)
								.addField(
									"Voice Channel",
									degree.degreeVoiceChannelId ?? "[NOT SET]",
									true
								)
								.addField(
									"Announcements Channel",
									degree.announcementsChannelId
										? `<#${degree.announcementsChannelId}>`
										: "[NOT SET]",
									true
								)
								.addField(
									"Course Selection Channel",
									degree.courseSelectionChannelId
										? `<#${degree.courseSelectionChannelId}>`
										: "[NOT SET",
									true
								),
						],
					});
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

				await prisma.degree.delete({ where: { acronym } });

				await interaction.editReply(
					utils.CheckMarkEmoji + "Successfully removed."
				);
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

				await prisma.degree.update({
					where: { acronym },
					data: { name: newName },
				});

				await interaction.editReply(
					utils.CheckMarkEmoji +
						`Successfully renamed ${acronym} to ${newName}`
				);
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

				await prisma.degree.update({
					where: { acronym },
					data: { roleId: newRole.id },
				});

				await interaction.editReply(
					utils.CheckMarkEmoji +
						`Successfully set role of ${acronym} to <@&${newRole.id}>`
				);
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
				const numTier = parseInt(newTier);

				if (isNaN(numTier) || tierChoices[numTier] === undefined) {
					await interaction.editReply(utils.XEmoji + "Invalid tier");
					return;
				}

				await prisma.degree.update({
					where: { acronym },
					data: { tier: numTier },
				});

				await interaction.editReply(
					utils.CheckMarkEmoji +
						`Successfully set tier of ${acronym} to ${newTier}`
				);
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
				const newChannel = interaction.options.getChannel(
					"new-channel",
					true
				) as Discord.GuildChannel;

				const key = {
					["degree-text"]: "degreeText",
					["degree-voice"]: "degreeVoice",
					["announcements"]: "announcements",
					["course-selection"]: "courseSelection",
				}[channelType];

				if (key === undefined) {
					await interaction.editReply(
						utils.XEmoji + "Invalid channel type"
					);
					return;
				}

				if (channelType === "degreeVoice" && !newChannel.isVoice()) {
					await interaction.editReply(
						utils.XEmoji + "Must be a voice channel"
					);
					return;
				} else if (
					channelType !== "degreeVoice" &&
					newChannel.isVoice()
				) {
					await interaction.editReply(
						utils.XEmoji + "Must not be a voice channel"
					);
					return;
				}

				await prisma.degree.update({
					where: { acronym },
					data: { [key]: newChannel.id },
				});

				await interaction.editReply(
					utils.CheckMarkEmoji +
						`Successfully set role of ${acronym} to <@&${newChannel.id}>`
				);
			} catch (e) {
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}

			break;
		}
		case "refresh-courses": {
			try {
				const acronym = interaction.options.getString("acronym", true);

				const degree = await prisma.degree.findUnique({
					where: { acronym },
				});
				if (!degree) {
					await interaction.editReply(
						utils.XEmoji + `Degree \`${acronym}\` not found!`
					);
					return;
				}

				await courses.importCoursesFromDegree(
					prisma,
					degree.fenixId,
					true
				);

				await interaction.editReply(
					utils.CheckMarkEmoji +
						`Degree \`${acronym}\`'s courses have been refreshed!`
				);
			} catch (e) {
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}
		}
	}
}
