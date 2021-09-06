// Handler for role selection

import { PrismaClient } from "@prisma/client";
import Discord from "discord.js";
import { getConfigFactory } from "./utils";
import * as Builders from "@discordjs/builders";
import { CommandDescriptor } from "../bot.d";

const MAX_COMPONENTS_PER_ROW = 5;
const MAX_ROWS_PER_MESSAGE = 5;

const TOURIST_GROUP_ID = "__tourist"; // must be unique in database
const TOURIST_BUTTON_STYLE = "SECONDARY";

// TODO: load from fénix into database

export async function sendRoleSelectionMessages(
	client: Discord.Client,
	prisma: PrismaClient,
	editExisting = false
): Promise<void> {
	const groups = await prisma.roleGroup.findMany({
		include: { options: true },
	});

	const getTouristConfig = getConfigFactory(prisma, "tourist");

	try {
		groups.push({
			id: TOURIST_GROUP_ID,
			mode: "buttons",
			placeholder: "N/A",
			message:
				(await getTouristConfig("message")) ??
				"Press if you're not from IST",
			channelId:
				(await getTouristConfig("channel_id", true)) ?? "missing",
			messageId: (await getTouristConfig("message_id")) ?? null,
			minValues: null,
			maxValues: null,
			options: [
				{
					label: (await getTouristConfig("label")) ?? "I'm a TourIST",
					description: TOURIST_BUTTON_STYLE,
					value:
						(await getTouristConfig("role_id", true)) ?? "missing",
					emoji: null,
					roleGroupId: TOURIST_GROUP_ID,
				},
			],
		});
	} catch (e) {
		console.error(`Failed to inject tourist group: ${e.message}`);
	}

	for (const group of groups) {
		try {
			const channel = client.channels.cache.find(
				(c) => c.id === group.channelId
			);
			if (channel === undefined || !channel.isText()) {
				throw new Error("Could not find channel");
			}

			let message;

			if (
				group.messageId === null ||
				!(message = await channel.messages
					.fetch(group.messageId as string)
					.catch(() => null)) ||
				editExisting
			) {
				let components;

				if (group.mode === "menu") {
					components = [
						new Discord.MessageActionRow().addComponents(
							new Discord.MessageSelectMenu()
								.setCustomId(`roleSelection:${group.id}`)
								.setPlaceholder(group.placeholder)
								.setMinValues(group.minValues ?? 1)
								.setMaxValues(group.maxValues ?? 1)
								.addOptions(
									group.options as Discord.MessageSelectOptionData[]
								)
						),
					];
				} else if (group.mode === "buttons") {
					const rows: Discord.MessageButton[][] = [];
					let curRow: Discord.MessageButton[] = [];

					for (const opt of group.options) {
						if (
							curRow.length &&
							curRow.length % MAX_COMPONENTS_PER_ROW === 0
						) {
							rows.push(curRow);
							curRow = [];
						}

						const btn = new Discord.MessageButton()
							.setCustomId(
								`roleSelection:${group.id}:${opt.value}`
							)
							.setLabel(opt.label)
							.setStyle(
								([
									"PRIMARY",
									"SECONDARY",
									"SUCCESS",
									"DANGER",
									"LINK",
								].includes(opt.description)
									? opt.description
									: "PRIMARY") as Discord.MessageButtonStyleResolvable
							);
						if (opt.emoji !== null) {
							btn.setEmoji(opt.emoji);
						}
						curRow.push(btn);
					}

					if (curRow.length) {
						rows.push(curRow);
					}
					if (rows.length > MAX_ROWS_PER_MESSAGE) {
						throw new Error(
							`Too many buttons (${
								(rows.length - 1) * MAX_COMPONENTS_PER_ROW +
								rows[rows.length - 1].length
							} > ${
								MAX_COMPONENTS_PER_ROW * MAX_ROWS_PER_MESSAGE
							})`
						);
					}
					components = rows.map((r) =>
						new Discord.MessageActionRow().addComponents(r)
					);
				} else {
					throw new Error(`Unknown mode '${group.mode}'`);
				}

				if (components) {
					const args = {
						content: group.message,
						components,
					};
					const msg =
						message && editExisting
							? await message.edit(args)
							: await (channel as Discord.TextChannel).send(args);

					if (group.id === TOURIST_GROUP_ID) {
						const key = "tourist:message_id";
						await prisma.config.upsert({
							where: { key },
							create: { key, value: msg.id },
							update: { value: msg.id },
						});
					} else {
						await prisma.roleGroup.update({
							where: { id: group.id },
							data: { messageId: msg.id },
						});
					}
				}
			}
		} catch (e) {
			console.error(
				`Could not send role selection message for group ${group.id} because: ${e.message}`
			);
		}
	}
}

async function handleRoleSelection(
	groupId: string,
	roles: Discord.GuildMemberRoleManager,
	roleToAdd: string,
	prisma: PrismaClient
) {
	const touristExclusive = (
		(await getConfigFactory(prisma, "tourist")("exclusive_role_groups")) ??
		"degree,year"
	).split(",");

	const groupRoles =
		groupId === TOURIST_GROUP_ID
			? [
					roleToAdd,
					...(
						await prisma.roleGroup.findMany({
							where: {
								OR: touristExclusive.map((e) => ({ id: e })),
							},
							include: { options: true },
						})
					).flatMap((g) => g.options.map((o) => o.value)),
			  ]
			: (
					(
						await prisma.roleGroup.findFirst({
							where: { id: groupId },
							include: { options: true },
						})
					)?.options.map((o) => o.value) ?? []
			  ).concat(
					[
						touristExclusive.includes(groupId)
							? (
									await prisma.config.findFirst({
										where: { key: "tourist:role_id" },
									})
							  )?.value
							: undefined,
					].filter((e) => e !== undefined) as string[]
			  );

	try {
		if (groupRoles.includes(roleToAdd)) {
			const rolesToSet = [roleToAdd];
			for (const id of roles.cache.keys()) {
				if (!groupRoles.includes(id)) {
					rolesToSet.push(id);
				}
			}
			await roles.set(rolesToSet);
			return true;
		} else {
			throw new Error("Role not in group");
		}
	} catch (e) {
		return false;
	}
}

export async function handleRoleSelectionMenu(
	interaction: Discord.SelectMenuInteraction,
	prisma: PrismaClient
): Promise<void> {
	await interaction.deferReply({ ephemeral: true });

	const groupId = interaction.customId.split(":")[1];
	const roles = interaction.member?.roles as Discord.GuildMemberRoleManager;
	const roleToAdd = interaction.values[0]; // FIXME: this won't work for multiselects!

	if (await handleRoleSelection(groupId, roles, roleToAdd, prisma)) {
		await interaction.editReply("✅ Role applied.");
	} else {
		await interaction.editReply("❌ Failed to apply role.");
	}
}
// FIXME: these two (v & ^) are a bit humid
export async function handleRoleSelectionButton(
	interaction: Discord.ButtonInteraction,
	prisma: PrismaClient
): Promise<void> {
	await interaction.deferReply({ ephemeral: true });

	const sp = interaction.customId.split(":");
	const roles = interaction.member?.roles as Discord.GuildMemberRoleManager;

	if (await handleRoleSelection(sp[1], roles, sp[2], prisma)) {
		await interaction.editReply("✅ Role applied.");
	} else {
		await interaction.editReply("❌ Failed to apply role.");
	}
}

export function provideCommands(): CommandDescriptor[] {
	const cmd = new Builders.SlashCommandBuilder()
		.setName("role-selection")
		.setDescription("Manage the role selection module");
	cmd.addSubcommandGroup(
		new Builders.SlashCommandSubcommandGroupBuilder()
			.setName("group")
			.setDescription("Manage role selection groups")
			.addSubcommand(
				new Builders.SlashCommandSubcommandBuilder()
					.setName("create")
					.setDescription("Create a new role selection group")
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("id")
							.setDescription("Unique identifier, snake_case")
							.setRequired(true)
					)
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("mode")
							.setDescription("How users may choose roles")
							.setRequired(true)
							.addChoice("Selection Menu", "menu")
							.addChoice("Buttons", "buttons")
					)
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("placeholder")
							.setDescription(
								"Shown in select menus when no options are selected; ignored otherwise"
							)
							.setRequired(true)
					)
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("message")
							.setDescription("Message sent with menu/buttons")
							.setRequired(true)
					)
					// FIXME: no multiselect support yet, so not asking for minValues/maxValues
					.addChannelOption(
						new Builders.SlashCommandChannelOption()
							.setName("channel")
							.setDescription(
								"Channel where to send role selection message"
							)
							.setRequired(true)
					)
			)
			.addSubcommand(
				new Builders.SlashCommandSubcommandBuilder()
					.setName("delete")
					.setDescription(
						"Delete a role selection group (this action cannot be reverted!)"
					)
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("id")
							.setDescription(
								"Unique identifier of the role to delete"
							)
							.setRequired(true)
					)
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("confirm-id")
							.setDescription("Type id again to confirm")
							.setRequired(true)
					)
			)
			.addSubcommand(
				new Builders.SlashCommandSubcommandBuilder()
					.setName("edit")
					.setDescription(
						"Change a setting for an existing role selection group"
					)
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("id")
							.setDescription(
								"Unique identifier of the role group"
							)
							.setRequired(true)
					)
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("name")
							.setDescription("Property to set")
							.setRequired(true)
							.addChoice("Mode", "mode")
							.addChoice("Placeholder", "placeholder")
							.addChoice("Message", "message")
					)
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("value")
							.setDescription("New value to set")
							.setRequired(true)
					)
			)
			.addSubcommand(
				new Builders.SlashCommandSubcommandBuilder()
					.setName("move")
					.setDescription("Move role group to a new channel")
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("id")
							.setDescription(
								"Unique identifier of the role group"
							)
							.setRequired(true)
					)
					.addChannelOption(
						new Builders.SlashCommandChannelOption()
							.setName("channel")
							.setDescription("New channel to send message to")
							.setRequired(true)
					)
			)
			.addSubcommand(
				new Builders.SlashCommandSubcommandBuilder()
					.setName("view")
					.setDescription("Get information for a role group")
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("id")
							.setDescription(
								"Unique identifier of the role group"
							)
							.setRequired(true)
					)
			)
			.addSubcommand(
				new Builders.SlashCommandSubcommandBuilder()
					.setName("list")
					.setDescription("List all existing role selection groups")
			)
	);
	cmd.addSubcommandGroup(
		new Builders.SlashCommandSubcommandGroupBuilder()
			.setName("options")
			.setDescription("Manage options for a role selection group")
			.addSubcommand(
				new Builders.SlashCommandSubcommandBuilder()
					.setName("add")
					.setDescription(
						"Add a new option to a role selection group"
					)
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("group-id")
							.setDescription(
								"Unique identifier of the role group"
							)
							.setRequired(true)
					)
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("label")
							.setDescription("New option's name")
							.setRequired(true)
					)
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("description")
							.setDescription(
								"For menus, shown to the user below the label. For buttons, specifies the button style (in caps)"
							)
							.setRequired(true)
					)
					.addRoleOption(
						new Builders.SlashCommandRoleOption()
							.setName("role")
							.setDescription("Role corresponding to this option")
							.setRequired(true)
					)
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("emoji")
							.setDescription(
								"Single emote to show next to label"
							)
							.setRequired(false)
					)
			)
			.addSubcommand(
				new Builders.SlashCommandSubcommandBuilder()
					.setName("remove")
					.setDescription("Remove an option from a role group")
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("group-id")
							.setDescription(
								"Unique identifier of the role group"
							)
							.setRequired(true)
					)
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("label")
							.setDescription(
								"Label corresponding to the option to remove"
							)
							.setRequired(true)
					)
			)
	);
	cmd.addSubcommandGroup(
		new Builders.SlashCommandSubcommandGroupBuilder()
			.setName("apply")
			.setDescription(
				"Apply changes made to role groups and respective options"
			)
			.addSubcommand(
				new Builders.SlashCommandSubcommandBuilder()
					.setName("send-messages")
					.setDescription("Send messages for all role groups")
					.addBooleanOption(
						new Builders.SlashCommandBooleanOption()
							.setName("edit-existing")
							.setDescription(
								"Whether to edit existing messages, updating them. Otherwise, you may delete some before running this"
							)
							.setRequired(true)
					)
			)
	);
	return [{ builder: cmd, handler: handleCommand }];
}

async function createGroup(
	prisma: PrismaClient,
	id: string,
	mode: string,
	placeholder: string,
	message: string,
	channel: Discord.GuildChannel
): Promise<[boolean, string]> {
	try {
		if (!id.match(/^[a-z0-9_]+$/)) {
			return [false, "Invalid id: must be snake_case"];
		}

		const goodModes = ["buttons", "menu"];
		if (!goodModes.includes(mode)) {
			return [
				false,
				"Invalid mode: may only be one of " + goodModes.join("/"),
			];
		}

		message = message.replace("\\n", "\n");

		if (!channel.isText()) {
			return [false, "Invalid channel: must be a text channel"];
		}

		return [
			true,
			(
				await prisma.roleGroup.create({
					data: {
						id,
						mode,
						placeholder,
						message,
						channelId: channel.id,
					},
				})
			).id,
		];
	} catch (e) {
		return [false, "Something went wrong"];
	}
}

async function deleteGroup(
	prisma: PrismaClient,
	id: string,
	confirm: string
): Promise<true | string> {
	try {
		if (id !== confirm) {
			return "Confirmation failed";
		}

		if (!id.match(/^[a-z0-9_]+$/)) {
			return "Invalid id: must be snake_case";
		}

		await prisma.roleGroup.delete({ where: { id } });

		return true;
	} catch (e) {
		return "Something went wrong; possibly, no role group was found with that ID";
	}
}

async function editGroup(
	prisma: PrismaClient,
	id: string,
	name: string,
	value: string
): Promise<true | string> {
	try {
		if (!id.match(/^[a-z0-9_]+$/)) {
			return "Invalid id: must be snake_case";
		}

		const goodNames = ["mode", "placeholder", "message"];
		if (!goodNames.includes(name)) {
			return "Invalid name: must be one of " + goodNames.join("/");
		}

		const goodModes = ["menu", "buttons"];
		if (name === "mode" && !goodModes.includes(value)) {
			return "Invalid mode: must be one of " + goodModes.join("/");
		}

		await prisma.roleGroup.update({
			where: { id },
			data: { [name]: value },
		});

		return true;
	} catch (e) {
		return "Something went wrong; possibly, no role group was found with that ID";
	}
}

async function moveGroup(
	prisma: PrismaClient,
	id: string,
	channel: Discord.GuildChannel
): Promise<true | string> {
	try {
		if (!id.match(/^[a-z0-9_]+$/)) {
			return "Invalid id: must be snake_case";
		}

		if (!channel.isText()) {
			return "Invalid channel: must be a text channel";
		}

		await prisma.roleGroup.update({
			where: { id },
			data: { channelId: channel.id },
		});

		return true;
	} catch (e) {
		return "Something went wrong; possibly, no role group was found with that ID";
	}
}

async function viewGroup(
	prisma: PrismaClient,
	id: string,
	guildId: string
): Promise<Discord.WebhookEditMessageOptions | string> {
	try {
		const group = await prisma.roleGroup.findFirst({
			where: { id },
			include: { options: true },
		});
		if (group) {
			const embed = new Discord.MessageEmbed().setTitle(
				"Role Group Information"
			).setDescription(`**ID**: ${group.id}
				**Mode:** ${group.mode}
				**Placeholder:** ${group.placeholder}
				**Message:** ${group.message}
				**Channel:** <#${group.channelId}>
				**Message:** ${
					group.messageId
						? "[Here](https://discord.com/channels/" +
						  guildId +
						  "/" +
						  group.channelId +
						  "/" +
						  group.messageId +
						  " 'Message Link')"
						: "NONE"
				}`);

			for (const opt of group.options) {
				embed.addField(
					(opt.emoji ? opt.emoji + " " : "") + opt.label,
					opt.value + " - " + opt.description,
					true
				);
			}

			return {
				embeds: [embed],
			};
		} else {
			return `No group was found with ID \`${id}\``;
		}
	} catch (e) {
		return "Something went wrong";
	}
}

async function addOption(
	prisma: PrismaClient,
	groupId: string,
	label: string,
	description: string,
	role: Discord.Role,
	emoji: string | null
): Promise<true | string> {
	try {
		if (!groupId.match(/^[a-z0-9_]+$/)) {
			return "Invalid group id: must be snake_case";
		}

		const group = await prisma.roleGroup.findFirst({
			where: { id: groupId },
		});

		if (group === null) {
			return "No group was found with that ID";
		}

		await prisma.roleGroupOption.create({
			data: {
				label,
				description,
				value: role.id,
				emoji,
				roleGroupId: group.id,
			},
		});

		return true;
	} catch (e) {
		return "Something went wrong; possibly, that role is already associated with an option";
	}
}

async function removeOption(
	prisma: PrismaClient,
	groupId: string,
	label: string
): Promise<true | string> {
	try {
		if (!groupId.match(/^[a-z0-9_]+$/)) {
			return "Invalid group id: must be snake_case";
		}

		const group = await prisma.roleGroup.findFirst({
			where: { id: groupId },
		});

		if (group === null) {
			return "No group was found with that ID";
		}

		const possible = await prisma.roleGroupOption.findMany({
			where: {
				label,
				roleGroupId: group.id,
			},
		});

		if (possible.length < 1) {
			return "No such option was found";
		} else if (possible.length > 1) {
			return "Several options have this label; in the future a command to remove an option by its associated role (unique) may be added";
		}

		await prisma.roleGroupOption.delete({
			where: { value: possible[0].value },
		});

		return true;
	} catch (e) {
		return "Something went wrong";
	}
}

// TODO: dry this a bit
export async function handleCommand(
	interaction: Discord.CommandInteraction,
	prisma: PrismaClient,
	client: Discord.Client
): Promise<void> {
	const subCommandGroup = interaction.options.getSubcommandGroup();
	const subCommand = interaction.options.getSubcommand();
	switch (subCommandGroup) {
		case "group":
			switch (subCommand) {
				case "create": {
					const [succ, res] = await createGroup(
						prisma,
						interaction.options.getString("id", true),
						interaction.options.getString("mode", true),
						interaction.options.getString("placeholder", true),
						interaction.options.getString("message", true),
						interaction.options.getChannel(
							"channel",
							true
						) as Discord.GuildChannel
						// FIXME: I've no clue what a APIInteractionDataResolvedChannel is
						// so I'm ignoring the possibility of it even existing
					);
					if (succ) {
						await interaction.editReply(
							`✅ Role selection group \`${res}\` successfully created.`
						);
					} else {
						await interaction.editReply(
							`❌ Could not create group because: **${res}**`
						);
					}
					break;
				}
				case "delete": {
					const id = interaction.options.getString("id", true);
					const res = await deleteGroup(
						prisma,
						id,
						interaction.options.getString("confirm-id", true)
					);
					if (res === true) {
						await interaction.editReply(
							`✅ Role selection group \`${id}\` successfully deleted.`
						);
					} else {
						await interaction.editReply(
							`❌ Could not delete group because: **${res}**`
						);
					}
					break;
				}
				case "edit": {
					const id = interaction.options.getString("id", true);
					const res = await editGroup(
						prisma,
						id,
						interaction.options.getString("name", true),
						interaction.options.getString("value", true)
					);
					if (res === true) {
						await interaction.editReply(
							`✅ Role selection group \`${id}\` successfully edited.`
						);
					} else {
						await interaction.editReply(
							`❌ Could not edit group because: **${res}**`
						);
					}
					break;
				}
				case "move": {
					const id = interaction.options.getString("id", true);
					const channel = interaction.options.getChannel(
						"channel",
						true
					) as Discord.GuildChannel;
					const res = await moveGroup(prisma, id, channel);
					if (res === true) {
						await interaction.editReply(
							`✅ Role selection group \`${id}\` successfully moved to <#${channel.id}>.`
						);
					} else {
						await interaction.editReply(
							`❌ Could not move group because: **${res}**`
						);
					}
					break;
				}
				case "view": {
					await interaction.editReply(
						await viewGroup(
							prisma,
							interaction.options.getString("id", true),
							interaction.guildId as string
						)
					);
					break;
				}
				case "list": {
					try {
						await interaction.editReply({
							embeds: [
								new Discord.MessageEmbed()
									.setTitle("Role Selection Groups")
									.setDescription(
										"All available role groups are listed below with their `mode` field."
									)
									.addFields(
										(
											await prisma.roleGroup.findMany()
										).map((g) => ({
											name: g.id,
											value: g.mode,
											inline: true,
										}))
									),
							],
						});
					} catch (e) {
						console.error(
							"Could not list role groups because: ",
							e.message
						);
						await interaction.editReply(
							"❌ Failed to list role groups."
						);
					}
					break;
				}
			}
			break;
		case "options":
			switch (subCommand) {
				case "add": {
					const res = await addOption(
						prisma,
						interaction.options.getString("group-id", true),
						interaction.options.getString("label", true),
						interaction.options.getString("description", true),
						interaction.options.getRole(
							"role",
							true
						) as Discord.Role,
						interaction.options.getString("emoji", false)
					);
					if (res === true) {
						await interaction.editReply(
							"✅ Option successfully added."
						);
					} else {
						await interaction.editReply(
							`❌ Could not add option because: **${res}**`
						);
					}
					break;
				}
				case "remove": {
					const res = await removeOption(
						prisma,
						interaction.options.getString("group-id", true),
						interaction.options.getString("label", true)
					);
					if (res === true) {
						await interaction.editReply(
							"✅ Option successfully removed."
						);
					} else {
						await interaction.editReply(
							`❌ Could not remove option because: **${res}**`
						);
					}
					break;
				}
			}
			break;
		case "apply":
			switch (subCommand) {
				case "send-messages": {
					try {
						await sendRoleSelectionMessages(
							client,
							prisma,
							interaction.options.getBoolean(
								"edit-existing",
								true
							)
						);

						await interaction.editReply(
							"✅ Role selection messages successfully sent."
						);
					} catch (e) {
						console.error(
							"Could not send role selection messages:",
							e.message
						);
						await interaction.editReply(
							"❌ Failed to send role selection messages."
						);
					}
					break;
				}
			}
	}
}
