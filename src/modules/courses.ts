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
					.setName("delete_role")
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
					.setName("old_acronym")
					.setDescription("The acronym of the course to be renamed")
					.setRequired(true)
			)
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("new_acronym")
					.setDescription(
						"The acronym to show on channel name and role (e.g. CDI-I)"
					)
					.setRequired(true)
			)
	);

	return [{ builder: cmd, handler: handleCommand }];
}

export async function handleCommand(
	interaction: Discord.CommandInteraction,
	prisma: PrismaClient
): Promise<void> {
	if (!interaction.guild) return;

	switch (interaction.options.getSubcommand()) {
		case "refresh-channels": {
			try {
				const orphanChannels = await refreshCourses(
					prisma,
					interaction.guild
				);

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
				console.error(e);
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
					.filter((v) => !!v && v.type === "GUILD_CATEGORY");

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

				await interaction.editReply(
					utils.CheckMarkEmoji +
						"Sucessfully updated course categories.\n" +
						categories.map((c) => `- <#${c?.id}>`).join("\n")
				);
			} catch (e) {
				console.error(e);
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
					interaction.options.getBoolean("delete_role", false) ??
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
						await interaction.editReply(
							utils.XEmoji +
								"Could not delete channel and/or role, but settings were updated correctly. Please delete the channel/role manually."
						);
						return;
					}
					await interaction.editReply(
						utils.CheckMarkEmoji +
							`Course \`${course.name}\` is now hidden`
					);
				} else {
					await refreshCourses(prisma, interaction.guild);
					await interaction.editReply(
						utils.CheckMarkEmoji +
							`Course \`${course.name}\` is now being shown`
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
		case "rename": {
			try {
				const oldAcronym = interaction.options.getString(
					"old_acronym",
					true
				);
				const newAcronym = interaction.options.getString(
					"new_acronym",
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
						courseChannel.edit(
							{
								name: newAcronym.toLowerCase(),
								topic: `${course.name} - ${newAcronym}`,
							},
							`Course rename by ${interaction.user.tag}`
						);
					}
					if (roleChannel) {
						roleChannel.setName(
							newAcronym,
							`Course rename by ${interaction.user.tag}`
						);
					}
				} catch (e) {
					console.error(e);
					await interaction.editReply(
						utils.XEmoji +
							"Failed to rename channel and/or role, but renamed course on database. Please rename channel and/or role manully."
					);
				}

				await interaction.editReply(
					utils.CheckMarkEmoji + "Course renamed succesfully!"
				);
			} catch (e) {
				console.error(e);
				await interaction.editReply(
					utils.XEmoji +
						"Something went wrong. Maybe there is already another course with the desired acronym?"
				);
			}

			break;
		}
	}
}

export async function importCoursesFromDegree(
	prisma: PrismaClient,
	degreeId: string
): Promise<void> {
	const degreeCourses = await fenix.getDegreeCourses(degreeId);

	await Promise.all(
		degreeCourses.map(async (course) => {
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

			await prisma.degreeCourse.create({
				data: {
					id: `${degreeId}-${course.acronym}`,
					degreeFenixId: degreeId,
					courseAcronym: course.acronym,
					year: course.year,
					semester: course.semester,
				},
			});
		})
	);
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
	).filter((channel) => channel?.type === "GUILD_CATEGORY");
	if (!categoriesChannels.length) {
		throw new Error("No category channels configured");
	}

	const getNextFreeCategory = () =>
		categoriesChannels.find((v) => v.children.size < 50);

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
	>().concat(...categoriesChannels.map((v) => v.children));
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
			await prisma.course.update({
				where: { acronym: course.acronym },
				data: { roleId: courseRole.id },
			});
		} else if (courseRole.name !== course.acronym) {
			await courseRole.setName(course.acronym, reason);
		}

		const courseChannelTopic = `${course.name} - ${course.displayAcronym}`;
		if (!courseChannel) {
			courseChannel = await guild.channels.create(
				course.displayAcronym.toLowerCase(),
				{
					type: "GUILD_TEXT",
					topic: courseChannelTopic,
					parent: getNextFreeCategory(),
					reason,
					permissionOverwrites: [
						{
							id: guild.roles.everyone.id,
							deny: [Discord.Permissions.FLAGS.VIEW_CHANNEL],
						},
						{
							id: courseRole,
							allow: [Discord.Permissions.FLAGS.VIEW_CHANNEL],
						},
					],
				}
			);
			await prisma.course.update({
				where: { acronym: course.acronym },
				data: { channelId: courseChannel.id },
			});
		} else {
			if (courseChannel.name !== course.displayAcronym.toLowerCase()) {
				await courseChannel.setName(
					course.displayAcronym.toLowerCase()
				);
			}
			if (
				courseChannel.type === "GUILD_TEXT" &&
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
					.has(Discord.Permissions.FLAGS.VIEW_CHANNEL)
			) {
				await courseChannel.edit({
					permissionOverwrites: [
						{
							id: guild.roles.everyone.id,
							deny: [Discord.Permissions.FLAGS.VIEW_CHANNEL],
						},
						{
							id: courseRole,
							allow: [Discord.Permissions.FLAGS.VIEW_CHANNEL],
						},
					],
				});
			}
		}

		channels.delete(courseChannel.id);
	}, Promise.resolve());

	return channels.map((v) => v);
}

export async function generateRoleSelectionGroupsForCourseSelectionChannel(
	client: Discord.Client,
	prisma: PrismaClient,
	channelId: Discord.Snowflake
): Promise<(RoleGroup & { options: RoleGroupOption[] })[]> {
	const courses = await prisma.degreeCourse.findMany({
		where: {
			degree: {
				tier: { gte: 2 },
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

	const byYear: (DegreeCourse & { course: Course })[][] = [];
	for (const course of courses) {
		if (byYear[course.year] === undefined) {
			byYear[course.year] = [];
		}
		byYear[course.year].push(course);
	}

	const channel = (await client.channels.fetch(
		channelId
	)) as Discord.TextChannel;

	return byYear.map((yearCourses, year) =>
		((groupId) => ({
			id: groupId,
			mode: "menu",
			placeholder: `Escolhe cadeiras de ${year}º ano`,
			message: `Para acederes aos respetivos canais e receberes anúncios, escolhe em que cadeiras de ${year}º ano tens interesse.`,
			minValues: 0,
			maxValues: -1,
			channelId,
			messageId: channel.topic,
			options: yearCourses.map((c) => ({
				label: c.course.displayAcronym,
				description: `${c.course.name} (${c.semester}º Semestre)`,
				value: c.course.roleId as string,
				emoji: null,
				roleGroupId: groupId,
			})),
		}))(`__dc-${channelId}-${year}`)
	);
}

export async function getRoleSelectionGroupsForInjection(
	client: Discord.Client,
	prisma: PrismaClient
): Promise<
	ReturnType<typeof generateRoleSelectionGroupsForCourseSelectionChannel>
> {
	const channelIds = (
		await prisma.degree.findMany({
			where: {
				tier: { gte: 2 },
				courseSelectionChannelId: { not: null },
			},
		})
	).map((d) => d.courseSelectionChannelId as Discord.Snowflake);
	return [
		...(await Promise.all(
			channelIds.map((id) =>
				generateRoleSelectionGroupsForCourseSelectionChannel(
					client,
					prisma,
					id
				)
			)
		)),
	].flat();
}
