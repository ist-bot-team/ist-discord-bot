import { CommandDescriptor } from "./../bot.d";
// Controller for everything courses

import {
	PrismaClient,
	RoleGroup,
	RoleGroupOption,
	DegreeCourse,
	Course,
} from "@prisma/client";

import * as Discord from "discord.js";
import * as Builders from "@discordjs/builders";

import * as fenix from "./fenix";
import * as utils from "./utils";
import { OrphanChannel } from "./courses.d";
import logger from "../logger";

export function provideCommands(): CommandDescriptor[] {
	const cmd = new Builders.SlashCommandBuilder()
		.setName("courses")
		.setDescription("Manage courses");

	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("refresh-channels")
			.setDescription("Refresh course channels")
	);
	cmd.addSubcommand(
		[...new Array(5)].reduce(
			(builder, _, i) =>
				builder.addChannelOption(
					new Builders.SlashCommandChannelOption()
						.setName(`category${i + 1}`)
						.setDescription(`Category ${i + 1}`)
						.setRequired(i === 0)
				),
			new Builders.SlashCommandSubcommandBuilder()
				.setName("set-categories")
				.setDescription(
					"Set which categories the course channels should be created in"
				)
		)
	);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("toggle-channel-visibility")
			.setDescription(
				"Show or hide a course channel (and role) to remove clutter. This will delete course channel and role"
			)
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("acronym")
					.setDescription("The display acroynm of the course")
					.setRequired(true)
			)
			.addBooleanOption(
				new Builders.SlashCommandBooleanOption()
					.setName("delete-role")
					.setDescription(
						"If hiding channel, delete the course role as well (true by default)"
					)
					.setRequired(false)
			)
	);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("rename")
			.setDescription("Set display acronym of course")
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("old-acronym")
					.setDescription("The acronym of the course to be renamed")
					.setRequired(true)
			)
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("new-acronym")
					.setDescription(
						"The acronym to show on channel name and role (e.g. CDI-I)"
					)
					.setRequired(true)
			)
	);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("list-degrees-with-course")
			.setDescription("Show which degrees have a specific course")
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("acronym")
					.setDescription("The acronym of the course in question")
					.setRequired(true)
			)
	);
	cmd.addSubcommandGroup(
		new Builders.SlashCommandSubcommandGroupBuilder()
			.setName("academic-year")
			.setDescription("Manage the current academic year")
			.addSubcommand(
				new Builders.SlashCommandSubcommandBuilder()
					.setName("set")
					.setDescription(
						"Set the current academic year (e.g. 2020-2021)"
					)
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("academic-year")
							.setDescription(
								"The current academic year (e.g. 2020-2021)"
							)
							.setRequired(true)
					)
			)
			.addSubcommand(
				new Builders.SlashCommandSubcommandBuilder()
					.setName("get")
					.setDescription("Get the current academic year")
			)
	);

	return [{ builder: cmd, handler: handleCommand }];
}

export async function handleCommand(
	interaction: Discord.ChatInputCommandInteraction,
	prisma: PrismaClient
): Promise<void> {
	if (!interaction.guild) return;

	switch (
		interaction.options.getSubcommandGroup(false) ||
		interaction.options.getSubcommand()
	) {
		case "refresh-channels": {
			try {
				const orphanChannels = await refreshCourses(
					prisma,
					interaction.guild
				);

				logger.info("Refreshed courses channels");
				await interaction.editReply(
					utils.CheckMarkEmoji +
						"Sucessfully updated course channels." +
						(orphanChannels.length
							? `\nConsider deleting the following ${orphanChannels.length} orphan channel(s):\n` +
							  orphanChannels
									.map((c) => `- <#${c.id}>`)
									.join("\n")
							: "")
				);
			} catch (e) {
				logger.error(e, "Error while refreshing courses channels");
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}

			break;
		}
		case "set-categories": {
			try {
				const categories = [...Array(5)]
					.map((_, i) =>
						interaction.options.getChannel(
							`category${i + 1}`,
							i === 0
						)
					)
					.filter(
						(v) => v?.type === Discord.ChannelType.GuildCategory
					);

				if (categories.length === 0) {
					await interaction.editReply(
						utils.XEmoji + "No category channels provided"
					);
				}

				await prisma.config.upsert({
					where: { key: "courses:category_channels" },
					update: {
						value: categories.map((c) => c?.id || "").join(","),
					},
					create: {
						key: "courses:category_channels",
						value: categories.map((c) => c?.id || "").join(","),
					},
				});

				logger.info({ categories }, "Set course channels' categories");
				await interaction.editReply(
					utils.CheckMarkEmoji +
						"Sucessfully updated course categories.\n" +
						categories.map((c) => `- <#${c?.id}>`).join("\n")
				);
			} catch (e) {
				logger.error(
					e,
					"Error while setting course channels' categories"
				);
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}

			break;
		}
		case "toggle-channel-visibility": {
			try {
				const courseAcronym = interaction.options.getString(
					"acronym",
					true
				);
				const deleteRole =
					interaction.options.getBoolean("delete-role", false) ??
					true;

				const course = await prisma.course.findUnique({
					where: { displayAcronym: courseAcronym },
				});
				if (!course) {
					await interaction.editReply(
						utils.XEmoji + `Course \`${courseAcronym}\` not found!`
					);
					return;
				}

				const exists = !course.hideChannel;
				await prisma.course.update({
					where: { displayAcronym: courseAcronym },
					data: { hideChannel: exists },
				});

				if (exists) {
					await prisma.course.update({
						where: { displayAcronym: courseAcronym },
						data: { roleId: null, channelId: null },
					});
					try {
						const courseChannel =
							await interaction.guild.channels.fetch(
								course.channelId || ""
							);
						if (courseChannel && courseChannel.deletable) {
							courseChannel.delete();
						}
						if (deleteRole) {
							const courseRole =
								await interaction.guild.roles.fetch(
									course.roleId || ""
								);
							if (courseRole) {
								courseRole.delete(
									`${interaction.user.tag} has hidden course`
								);
							}
						}
					} catch (e) {
						logger.error(
							e,
							"Failed to delete channel and/or role while toggling course's channel visibility"
						);
						await interaction.editReply(
							utils.XEmoji +
								"Could not delete channel and/or role, but settings were updated correctly. Please delete the channel/role manually."
						);
						return;
					}
					logger.info({ course }, "Course channel has been hidden");
					await interaction.editReply(
						utils.CheckMarkEmoji +
							`Course \`${course.name}\` is now hidden`
					);
				} else {
					await refreshCourses(prisma, interaction.guild);
					logger.info(
						{ course },
						"Course channel is now being shown"
					);
					await interaction.editReply(
						utils.CheckMarkEmoji +
							`Course \`${course.name}\` is now being shown`
					);
				}
			} catch (e) {
				logger.error(e, "Error while toggling channel visibility");
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}
			break;
		}
		case "rename": {
			try {
				const oldAcronym = interaction.options.getString(
					"old-acronym",
					true
				);
				const newAcronym = interaction.options.getString(
					"new-acronym",
					true
				);

				const course = await prisma.course.findUnique({
					where: { displayAcronym: oldAcronym },
				});
				if (!course) {
					await interaction.editReply(
						utils.XEmoji + `Course \`${oldAcronym}\` not found!`
					);
					return;
				}

				await prisma.course.update({
					where: { displayAcronym: oldAcronym },
					data: { displayAcronym: newAcronym },
				});

				try {
					const courseChannel =
						await interaction.guild.channels.fetch(
							course.channelId || ""
						);
					const roleChannel = await interaction.guild.roles.fetch(
						course.roleId || ""
					);
					if (courseChannel) {
						courseChannel.edit({
							name: newAcronym.toLowerCase(),
							topic: `${course.name} - ${newAcronym}`,
							reason: `Course rename by ${interaction.user.tag}`,
						});
					}
					if (roleChannel) {
						roleChannel.setName(
							newAcronym,
							`Course rename by ${interaction.user.tag}`
						);
					}
				} catch (e) {
					logger.error(e, "Error while renamming course channel");
					await interaction.editReply(
						utils.XEmoji +
							"Failed to rename channel and/or role, but renamed course on database. Please rename channel and/or role manully."
					);
				}

				logger.info({ oldAcronym, newAcronym }, "Renamed course");
				await interaction.editReply(
					utils.CheckMarkEmoji + "Course renamed succesfully!"
				);
			} catch (e) {
				logger.error(e, "Error while renamming course channel");
				await interaction.editReply(
					utils.XEmoji +
						"Something went wrong. Maybe there is already another course with the desired acronym?"
				);
			}

			break;
		}
		case "list-degrees-with-course": {
			try {
				const acronym = interaction.options.getString("acronym", true);
				const degrees = await prisma.degree.findMany({
					where: {
						courses: {
							some: {
								course: {
									OR: {
										acronym: acronym,
										displayAcronym: acronym,
									},
								},
							},
						},
					},
				});

				await interaction.editReply({
					embeds: [
						new Discord.EmbedBuilder()
							.setTitle("Degrees with Course")
							.setDescription(
								`Below are all degrees that need course \`${acronym}\`, as well as whether they have a tier high enough to justify having a channel for said course.`
							)
							.addFields(
								degrees.map((d) => ({
									name: d.acronym,
									value: `Tier ${d.tier} ${
										d.tier >= 2 ? "✅" : "❌"
									}`,
									inline: true,
								}))
							),
					],
				});
			} catch (e) {
				logger.error(e, "Error while listing degrees with course");
				await interaction.editReply(
					utils.XEmoji + "Something went wrong"
				);
			}
			break;
		}
		case "academic-year": {
			const subcommand = interaction.options.getSubcommand();
			switch (subcommand) {
				case "get": {
					try {
						const academicYear = (
							await prisma.config.findUnique({
								where: { key: "academic_year" },
							})
						)?.value;

						if (academicYear) {
							await interaction.editReply(
								`The current academic year is \`${academicYear}\``
							);
						} else {
							await interaction.editReply(
								`No academic year is currently set`
							);
						}
					} catch (e) {
						logger.error(e, "Error while getting academic year");
						await interaction.editReply(
							utils.XEmoji + "Something went wrong."
						);
					}
					break;
				}
				case "set": {
					try {
						const academicYear = interaction.options.getString(
							"academic-year",
							true
						);

						await prisma.config.upsert({
							where: { key: "academic_year" },
							update: { value: academicYear },
							create: {
								key: "academic_year",
								value: academicYear,
							},
						});

						logger.info(
							{ academicYear },
							"Academic year has been set"
						);
						await interaction.editReply(
							`The current academic year has been set to \`${academicYear}\``
						);
					} catch (e) {
						logger.error(e, "Error while setting academic year");
						await interaction.editReply(
							utils.XEmoji + "Something went wrong."
						);
					}
					break;
				}
			}
			break;
		}
	}
}

export async function importCoursesFromDegree(
	prisma: PrismaClient,
	degreeId: string,
	force = false
): Promise<void> {
	const academicYear = (
		await prisma.config.findUnique({ where: { key: "academic_year" } })
	)?.value;

	if (!academicYear) {
		throw Error("Academic year is not defined");
	}

	const degreeCourses = await fenix.getDegreeCourses(degreeId, academicYear);

	logger.info(
		{ degreeId },
		"Got %d courses from Fénix for degree",
		degreeCourses.length
	);

	if (force) {
		const idsToKeep = degreeCourses.map(
			(course) => `${degreeId}-${course.acronym}`
		);
		const deleteResult = await prisma.degreeCourse.deleteMany({
			where: { degreeFenixId: degreeId, id: { notIn: idsToKeep } },
		});

		logger.info(
			{ degreeId },
			"Deleted %d orphan courses for degree",
			deleteResult.count
		);
	}

	for (const course of degreeCourses) {
		const globalCourse = await prisma.course.findUnique({
			where: { acronym: course.acronym },
		});

		if (!globalCourse) {
			// Create global course since it doesn't exist

			await prisma.course.create({
				data: {
					acronym: course.acronym,
					displayAcronym: course.acronym,
					name: course.name,
				},
			});
		}

		logger.debug({ course, degreeId }, "Upserting degree course");

		await prisma.degreeCourse.upsert({
			create: {
				id: `${degreeId}-${course.acronym}`,
				degreeFenixId: degreeId,
				courseAcronym: course.acronym,
				year: course.year,
				semester: course.semester,
				announcementsFeedUrl: course.announcementsFeedUrl,
				color: utils.generateHexCode(),
			},
			update: {
				degreeFenixId: degreeId,
				courseAcronym: course.acronym,
				year: course.year,
				semester: course.semester,
				announcementsFeedUrl: course.announcementsFeedUrl,
			},
			where: {
				id: `${degreeId}-${course.acronym}`,
			},
		});
	}
}

export async function refreshCourses(
	prisma: PrismaClient,
	guild: Discord.Guild
): Promise<OrphanChannel[]> {
	const reason = "Course channels refresh";

	const categoriesId = (
		(
			await prisma.config.findUnique({
				where: { key: "courses:category_channels" },
			})
		)?.value || ""
	)
		.split(",")
		.filter((v) => v !== "");

	const categoriesChannels: Discord.CategoryChannel[] = (
		await Promise.all(
			categoriesId.map(
				async (id) =>
					(await guild.channels.fetch(id)) as Discord.CategoryChannel
			)
		)
	).filter((channel) => channel?.type === Discord.ChannelType.GuildCategory);
	if (!categoriesChannels.length) {
		throw new Error("No category channels configured");
	}

	const getNextFreeCategory = () =>
		categoriesChannels.find((v) => v.children.cache.size < 50);

	// Get courses with associated degrees over tier 2
	const courses = await prisma.course.findMany({
		where: {
			perDegreeImplementations: {
				some: {
					degree: {
						tier: {
							gte: 2,
						},
					},
				},
			},
			hideChannel: false,
		},
	});
	const channels = new Discord.Collection<
		string,
		Discord.GuildChannel
	>().concat(...categoriesChannels.map((v) => v.children.cache));
	const roles = await guild.roles.fetch();

	await courses.reduce(async (prevPromise, course) => {
		await prevPromise;

		let courseRole =
			roles.get(course.roleId || "") ||
			roles.find((v) => v.name === course.displayAcronym);
		let courseChannel =
			channels.get(course.channelId || "") ||
			channels.find(
				(v) => v.name === course.displayAcronym.toLowerCase()
			);

		if (!courseRole) {
			courseRole = await guild.roles.create({
				name: course.displayAcronym,
				mentionable: false,
				reason,
			});
		} else if (courseRole.name !== course.displayAcronym) {
			await courseRole.setName(course.displayAcronym, reason);
		}
		if (course.roleId !== courseRole.id) {
			await prisma.course.update({
				where: { acronym: course.acronym },
				data: { roleId: courseRole.id },
			});
		}

		const courseChannelTopic = `${course.name} - ${course.displayAcronym}`;
		if (!courseChannel) {
			courseChannel = await guild.channels.create({
				name: course.displayAcronym.toLowerCase(),
				type: Discord.ChannelType.GuildText,
				topic: courseChannelTopic,
				parent: getNextFreeCategory(),
				reason,
				permissionOverwrites: [
					{
						id: guild.roles.everyone.id,
						deny: [Discord.PermissionFlagsBits.ViewChannel],
					},
					{
						id: courseRole,
						allow: [Discord.PermissionFlagsBits.ViewChannel],
					},
				],
			});
		} else {
			if (courseChannel.name !== course.displayAcronym.toLowerCase()) {
				await courseChannel.setName(
					course.displayAcronym.toLowerCase()
				);
			}
			if (
				courseChannel.type === Discord.ChannelType.GuildText &&
				(courseChannel as Discord.TextChannel).topic !==
					courseChannelTopic
			) {
				await (courseChannel as Discord.TextChannel).setTopic(
					courseChannelTopic,
					reason
				);
			}
			if (
				!courseChannel
					.permissionsFor(courseRole)
					.has(Discord.PermissionFlagsBits.ViewChannel)
			) {
				await courseChannel.edit({
					permissionOverwrites: [
						{
							id: guild.roles.everyone.id,
							deny: [Discord.PermissionFlagsBits.ViewChannel],
						},
						{
							id: courseRole,
							allow: [Discord.PermissionFlagsBits.ViewChannel],
						},
					],
				});
			}
		}
		if (course.channelId !== courseChannel.id) {
			await prisma.course.update({
				where: { acronym: course.acronym },
				data: { channelId: courseChannel.id },
			});
		}

		channels.delete(courseChannel.id);
	}, Promise.resolve());

	return channels.map((v) => v);
}

export async function generateRoleSelectionGroupsForCourseSelectionChannel(
	prisma: PrismaClient,
	channelId: Discord.Snowflake
): Promise<(RoleGroup & { options: RoleGroupOption[] })[]> {
	const courses = await prisma.degreeCourse.findMany({
		where: {
			degree: {
				courseSelectionChannelId: channelId,
			},
			course: {
				hideChannel: false,
				roleId: { not: null },
			},
		},
		include: { course: true },
	});
	courses.sort((a, b) =>
		a.course.displayAcronym.localeCompare(b.course.displayAcronym)
	);

	const byYear: Record<string, (DegreeCourse & { course: Course })[]> = {};
	for (const course of courses) {
		if (byYear[course.year] === undefined) {
			byYear[course.year] = [];
		}
		byYear[course.year].push(course);
	}

	return await Promise.all(
		Object.keys(byYear)
			.sort()
			.map(async (year) => {
				const yearCourses = utils.removeDuplicatesFromArray(
					byYear[year],
					(v) => v.course.roleId
				);
				const groupId = `__dc-${channelId}-${year}`;

				return {
					id: groupId,
					mode: "menu",
					placeholder: `Escolhe cadeiras de ${year}º ano`,
					message: `Para acederes aos respetivos canais e receberes anúncios, escolhe em que cadeiras de ${year}º ano tens interesse.`,
					minValues: 0,
					maxValues: -1,
					channelId,
					messageId:
						(
							await prisma.courseRoleSelectionMessage.findFirst({
								where: { injectedRoleGroupId: groupId },
							})
						)?.messageId ?? null,
					options: yearCourses.map((c) => ({
						label: c.course.displayAcronym,
						description: `${c.course.name} (${c.semester}º Semestre)`,
						value: c.course.roleId as string,
						emoji: null,
						roleGroupId: groupId,
					})),
				};
			})
	);
}

export async function getRoleSelectionGroupsForInjection(
	prisma: PrismaClient
): Promise<
	ReturnType<typeof generateRoleSelectionGroupsForCourseSelectionChannel>
> {
	const channelIds = (
		await prisma.degree.findMany({
			where: {
				courseSelectionChannelId: { not: null },
			},
		})
	).map((d) => d.courseSelectionChannelId as Discord.Snowflake);

	const uniqueChannelIds = utils.removeDuplicatesFromArray(channelIds);

	return [
		...(await Promise.all(
			uniqueChannelIds.map((id) =>
				generateRoleSelectionGroupsForCourseSelectionChannel(prisma, id)
			)
		)),
	].flat();
}
