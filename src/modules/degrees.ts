import { PrismaClient } from "@prisma/client";

import * as Discord from "discord.js";
import * as Builders from "@discordjs/builders";

import { CommandDescriptor } from "../bot.d";
import * as utils from "./utils";
import * as fenix from "./fenix";
import * as courses from "./courses";
import { OrphanChannel } from "./courses.d";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import logger from "../logger";

const tierChoices = [
	"None",
	"Degree channels (Text & VC)",
	"Course channels (& course selection channel)",
	"Announcements channel",
].map((desc, i) => ({
	name: `${i}: ${i > 1 ? i - 1 + " + " : ""}${desc}`,
	value: i.toString(),
}));

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
					.addChoices(...tierChoices)
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
					.addChoices(...tierChoices)
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
					.addChoices({ name: "Degree Text", value: "degree-text" })
					.addChoices({ name: "Degree Voice", value: "degree-voice" })
					.addChoices({
						name: "Announcements",
						value: "announcements",
					})
					.addChoices({
						name: "Course Selection",
						value: "course-selection",
					})
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
	if (!tierChoices.map((arr) => arr.value).includes(tier.toString())) {
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
					(c) =>
						c.type === ChannelType.GuildText && c.name === catName
				)
				.first() as Discord.CategoryChannel | undefined) ??
			(await guild.channels.create({
				name: catName,
				type: ChannelType.GuildCategory,
				permissionOverwrites: [
					{
						id: guild.roles.everyone.id,
						deny: [Discord.PermissionFlagsBits.ViewChannel],
					},
					{
						id: role.id,
						allow: [Discord.PermissionFlagsBits.ViewChannel],
					},
				],
				reason,
			}));
		if (!degreeTextChannel) {
			degreeTextChannel = await guild.channels.create({
				name: acronym.toLowerCase(),
				type: ChannelType.GuildText,
				topic: shortDegree.name,
				parent: category,
				reason,
			});
			await degreeTextChannel.lockPermissions();
		}
		if (!degreeVoiceChannel) {
			degreeVoiceChannel = await guild.channels.create({
				name: acronym.toUpperCase(),
				type: ChannelType.GuildVoice,
				parent: category,
				reason,
			});
			await degreeVoiceChannel.lockPermissions();
		}

		const restricted = [
			{
				id: guild.roles.everyone,
				deny: [
					PermissionFlagsBits.ViewChannel,
					PermissionFlagsBits.SendMessages,
				],
			},
			{
				id: role.id,
				allow: [PermissionFlagsBits.ViewChannel],
			},
		];

		if (!courseSelectionChannel) {
			courseSelectionChannel = await guild.channels.create({
				name: acronym.toLowerCase() + "-cadeiras",
				type: ChannelType.GuildText,
				topic: "Selecionar cadeiras",
				parent: category,
				reason,
				permissionOverwrites: restricted,
			});
		}

		if (tier >= 3) {
			if (!announcementsChannel) {
				const announcer = (await guild.roles.fetch())
					.filter((r) => r.name === "Announcer")
					.first();
				announcementsChannel = await guild.channels.create({
					name: acronym.toLowerCase() + "-announcements",
					type: ChannelType.GuildText,
					topic: shortDegree.name + " Announcements",
					parent: category,
					reason,
					permissionOverwrites: announcer
						? restricted.concat({
								id: announcer.id,
								allow: [
									Discord.PermissionFlagsBits.SendMessages,
								],
						  })
						: restricted,
				});
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
	interaction: Discord.ChatInputCommandInteraction,
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
				logger.error(e, "Error while creating degree");
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
						new Discord.EmbedBuilder()
							.setTitle("All Degrees")
							.setDescription(
								"Below are all known degrees, by acronym, Fénix ID and tier"
							)
							.addFields(
								degrees.map((d) => ({
									name: d.acronym,
									value: `${d.fenixId} (Tier ${d.tier})`,
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
							new Discord.EmbedBuilder()
								.setTitle("Degree Information")
								.setDescription(
									"Below are all the available details on this degree."
								)
								.addFields({
									name: "Acronym",
									value: degree.acronym,
									inline: true,
								})
								.addFields({
									name: "Name",
									value: degree.name,
									inline: true,
								})
								.addFields({
									name: "Fénix ID",
									value: degree.fenixId,
									inline: true,
								})
								.addFields({
									name: "Tier",
									value: degree.tier.toString(),
									inline: true,
								})
								.addFields({
									name: "Role",
									value: `<@&${degree.roleId}>`,
									inline: true,
								})
								.addFields({
									name: "Text Channel",
									value: degree.degreeTextChannelId
										? `<#${degree.degreeTextChannelId}>`
										: "[NOT SET]",
									inline: true,
								})
								.addFields({
									name: "Voice Channel",
									value:
										degree.degreeVoiceChannelId ??
										"[NOT SET]",
									inline: true,
								})
								.addFields({
									name: "Announcements Channel",
									value: degree.announcementsChannelId
										? `<#${degree.announcementsChannelId}>`
										: "[NOT SET]",
									inline: true,
								})
								.addFields({
									name: "Course Selection Channel",
									value: degree.courseSelectionChannelId
										? `<#${degree.courseSelectionChannelId}>`
										: "[NOT SET",
									inline: true,
								}),
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
					["degree-text"]: "degreeTextChannelId",
					["degree-voice"]: "degreeVoiceChannelId",
					["announcements"]: "announcementsChannelId",
					["course-selection"]: "courseSelectionChannelId",
				}[channelType];

				if (key === undefined) {
					await interaction.editReply(
						utils.XEmoji + "Invalid channel type"
					);
					return;
				}

				if (
					channelType === "degreeVoice" &&
					newChannel.type !== Discord.ChannelType.GuildVoice
				) {
					await interaction.editReply(
						utils.XEmoji + "Must be a voice channel"
					);
					return;
				} else if (
					channelType !== "degreeVoice" &&
					newChannel.type === Discord.ChannelType.GuildVoice
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
						`Successfully set ${channelType} of ${acronym} to <@#${newChannel.id}>`
				);
			} catch (e) {
				logger.error(e, "Error while setting channel of degree");
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
