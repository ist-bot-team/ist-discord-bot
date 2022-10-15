// Handler for role selection

import { PrismaClient, RoleGroup, RoleGroupOption } from "@prisma/client";
import Discord, {
	ButtonBuilder,
	SelectMenuBuilder,
	SelectMenuComponentOptionData,
} from "discord.js";
import * as Builders from "@discordjs/builders";

import { getConfigFactory } from "./utils";
import { CommandDescriptor } from "../bot.d";
import * as utils from "./utils";
import * as courses from "./courses";
import { parseButtonStyle } from "../utils/buttonStyleUtils";
import logger from "../logger";

const MAX_COMPONENTS_PER_ROW = 5;
const MAX_ROWS_PER_MESSAGE = 5;

// * IMPORTANT: all injected group IDs must start with __ to prevent collisions!

const TOURIST_GROUP_ID = "__tourist"; // must be unique in database
const TOURIST_BUTTON_STYLE = "SECONDARY";

const injectedGroups: {
	// FIXME: find a better way to do this, without global vars
	[groupId: string]: RoleGroup & {
		options: RoleGroupOption[];
		onSendCallback?: (
			prisma: PrismaClient,
			messageId: Discord.Snowflake
		) => Promise<void>;
	};
} = {};

// TODO: load from fénix into database

export async function sendRoleSelectionMessages(
	client: Discord.Client,
	prisma: PrismaClient,
	editExisting = false
): Promise<void> {
	const groups = await prisma.roleGroup.findMany({
		include: { options: true },
	});

	await injectGroups(prisma, groups);

	for (const group of groups) {
		try {
			const channel = client.channels.cache.find(
				(c) => c.id === group.channelId
			);
			if (channel === undefined || !channel.isTextBased()) {
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
					if (
						(group.maxValues ?? 1) > 0 &&
						group.options.length < (group.maxValues ?? 1)
					) {
						throw new Error(
							`Requires at least ${
								group.maxValues ?? 1
							} options, but got ${group.options.length}`
						);
					}

					// discord.js does not accept `null` as a value for `emoji`
					const options: SelectMenuComponentOptionData[] =
						group.options.map((option) => ({
							label: option.label,
							description: option.description,
							value: option.value,
							emoji: option.emoji ?? undefined,
						}));

					components = [
						new Discord.ActionRowBuilder<SelectMenuBuilder>().addComponents(
							new Discord.SelectMenuBuilder()
								.setCustomId(`roleSelection:${group.id}`)
								.setPlaceholder(group.placeholder)
								.setMinValues(group.minValues ?? 1)
								.setMaxValues(
									((v) => (v < 0 ? group.options.length : v))(
										group.maxValues ?? 1
									)
								)
								.addOptions(options)
						),
					];
				} else if (group.mode === "buttons") {
					const rows: Discord.ButtonBuilder[][] = [];
					let curRow: Discord.ButtonBuilder[] = [];

					for (const opt of group.options) {
						if (
							curRow.length &&
							curRow.length % MAX_COMPONENTS_PER_ROW === 0
						) {
							rows.push(curRow);
							curRow = [];
						}

						const btn = new Discord.ButtonBuilder()
							.setCustomId(
								`roleSelection:${group.id}:${opt.value}`
							)
							.setLabel(opt.label)
							.setStyle(parseButtonStyle(opt.description));
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
						new Discord.ActionRowBuilder<ButtonBuilder>().addComponents(
							r
						)
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

					if (group.id.startsWith("__")) {
						await injectedGroups[group.id]?.onSendCallback?.(
							prisma,
							msg.id
						);
					} else {
						await prisma.roleGroup.update({
							where: { id: group.id },
							data: { messageId: msg.id },
						});
					}
				}
			}
		} catch (e) {
			logger.error(
				e,
				"Could not send role selection message for group %s",
				group.id
			);
		}
	}
}

async function injectGroups(
	prisma: PrismaClient,
	groups: (RoleGroup & { options: RoleGroupOption[] })[]
) {
	try {
		await injectTouristGroup(prisma, groups);
		(await courses.getRoleSelectionGroupsForInjection(prisma)).map(
			(g) =>
				groups.push(g) &&
				(injectedGroups[g.id] = {
					...g,
					onSendCallback: async (prisma, messageId) => {
						await prisma.courseRoleSelectionMessage.upsert({
							where: { injectedRoleGroupId: g.id },
							update: { messageId },
							create: { injectedRoleGroupId: g.id, messageId },
						});
					},
				})
		);
	} catch (e) {
		logger.error(e, "Failed to inject groups");
	}
}

async function injectTouristGroup(
	prisma: PrismaClient,
	groups: (RoleGroup & { options: RoleGroupOption[] })[]
) {
	const getTouristConfig = getConfigFactory(prisma, "tourist");

	try {
		const group = {
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
		};
		groups.push(group);
		injectedGroups[TOURIST_GROUP_ID] = {
			...group,
			onSendCallback: async (prisma, messageId) => {
				const key = "tourist:message_id";
				await prisma.config.upsert({
					where: { key },
					create: { key, value: messageId },
					update: { value: messageId },
				});
			},
		};
	} catch (e) {
		logger.error(e, "Failed to inject tourist group");
	}
}

async function handleRoleSelection(
	groupId: string,
	roles: Discord.GuildMemberRoleManager,
	selectedRoles: string[],
	prisma: PrismaClient
): Promise<boolean> {
	const getTouristConfig = await getConfigFactory(prisma, "tourist");
	const touristExclusive = (
		(await getTouristConfig("exclusive_role_groups")) ?? "degree,year"
	).split(","); // TODO: allow changing this config with commands

	const groupRoles =
		groupId === TOURIST_GROUP_ID
			? [
					...selectedRoles,
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
						(await prisma.roleGroup.findFirst({
							where: { id: groupId },
							include: { options: true },
						})) ?? injectedGroups[groupId]
					)?.options.map((o) => o.value) ?? []
			  ).concat(
					[
						touristExclusive.includes(groupId)
							? await getTouristConfig("role_id")
							: undefined,
					].filter((e) => e !== undefined) as string[]
			  );

	try {
		if (selectedRoles.every((r) => groupRoles.includes(r))) {
			const rolesToSet = [...selectedRoles];
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
		logger.error(
			{ groupId, selectedRoles, err: e },
			"Failed to select role"
		);
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

	if (await handleRoleSelection(groupId, roles, interaction.values, prisma)) {
		await interaction.editReply(utils.CheckMarkEmoji + "Role applied.");
	} else {
		await interaction.editReply(utils.XEmoji + "Failed to apply role.");
	}
}
// FIXME: these two (v & ^) are a bit humid
export async function handleRoleSelectionButton(
	interaction: Discord.ButtonInteraction,
	prisma: PrismaClient
): Promise<void> {
	await interaction.deferReply({ ephemeral: true });

	const [_, groupId, selection] = interaction.customId.split(":");
	const roles = interaction.member?.roles as Discord.GuildMemberRoleManager;

	const courseSelectionChannelId = groupId.match(/^__dc-(\d+)-remove$/)?.[1];

	if (courseSelectionChannelId) {
		try {
			const num = await courses.handleRemoveCourseSelectionRoles(
				courseSelectionChannelId,
				roles,
				selection,
				prisma
			);
			await interaction.editReply(
				utils.CheckMarkEmoji +
					`Removed ${num} role${num != 1 ? "s" : ""}.`
			);
		} catch (e) {
			logger.error(
				{ courseSelectionChannelId, roleId: selection, err: e },
				"Failed to remove course selection roles"
			);
			await interaction.editReply(
				utils.XEmoji + "Failed to remove roles."
			);
		}
	} else if (await handleRoleSelection(groupId, roles, [selection], prisma)) {
		await interaction.editReply(utils.CheckMarkEmoji + "Role applied.");
	} else {
		await interaction.editReply(utils.XEmoji + "Failed to apply role.");
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
							.addChoices({
								name: "Selection Menu",
								value: "menu",
							})
							.addChoices({ name: "Buttons", value: "buttons" })
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
					.addChannelOption(
						new Builders.SlashCommandChannelOption()
							.setName("channel")
							.setDescription(
								"Channel where to send role selection message"
							)
							.setRequired(true)
					)
					.addIntegerOption(
						new Builders.SlashCommandIntegerOption()
							.setName("min")
							.setDescription(
								"At least how many options must be selected; default 1"
							)
							.setRequired(false)
					)
					.addIntegerOption(
						new Builders.SlashCommandIntegerOption()
							.setName("max")
							.setDescription(
								"At most how many options may be selected; default 1; negative = all"
							)
							.setRequired(false)
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
							.addChoices({ name: "Mode", value: "mode" })
							.addChoices({
								name: "Placeholder",
								value: "placeholder",
							})
							.addChoices({ name: "Message", value: "message" })
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
					.setName("set-num")
					.setDescription(
						"Set how many options may be selected at once"
					)
					.addIntegerOption(
						new Builders.SlashCommandIntegerOption()
							.setName("min")
							.setDescription(
								"At least how many options must be selected"
							)
							.setRequired(true)
					)
					.addIntegerOption(
						new Builders.SlashCommandIntegerOption()
							.setName("max")
							.setDescription(
								"At most how many options may be selected; negative = all"
							)
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
	cmd.addSubcommandGroup(
		new Builders.SlashCommandSubcommandGroupBuilder()
			.setName("tourist")
			.setDescription("Settings for the special TourIST group")
			.addSubcommand(
				new Builders.SlashCommandSubcommandBuilder()
					.setName("set-info")
					.setDescription("Change the message or button label")
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("field")
							.setDescription("Which field to change")
							.setRequired(true)
							.addChoices({ name: "Message", value: "message" })
							.addChoices({ name: "Label", value: "label" })
					)
					.addStringOption(
						new Builders.SlashCommandStringOption()
							.setName("value")
							.setDescription("Value to change to")
							.setRequired(true)
					)
			)
			.addSubcommand(
				new Builders.SlashCommandSubcommandBuilder()
					.setName("move")
					.setDescription("Set the channel where the message is sent")
					.addChannelOption(
						new Builders.SlashCommandChannelOption()
							.setName("channel")
							.setDescription("Channel where to move to")
							.setRequired(true)
					)
			)
			.addSubcommand(
				new Builders.SlashCommandSubcommandBuilder()
					.setName("set-role")
					.setDescription("Set the TourIST role")
					.addRoleOption(
						new Builders.SlashCommandRoleOption()
							.setName("role")
							.setDescription("TourIST role")
							.setRequired(true)
					)
			)
			.addSubcommand(
				new Builders.SlashCommandSubcommandBuilder()
					.setName("info")
					.setDescription(
						"Get all information relative to the TourIST role"
					)
			)
	);
	return [{ builder: cmd, handler: handleCommand }];
}

function validMinAndMaxValues(minValues: number, maxValues: number): boolean {
	return (
		minValues > 0 &&
		minValues <= 25 &&
		maxValues <= 25 &&
		(maxValues < 0 ? true : minValues <= maxValues)
	);
}

async function createGroup(
	prisma: PrismaClient,
	id: string,
	mode: string,
	placeholder: string,
	message: string,
	minValues: number,
	maxValues: number,
	channel: Discord.GuildChannel
): Promise<[boolean, string]> {
	try {
		if (!id.match(/^[a-z0-9_]+$/)) {
			return [false, "Invalid id: must be snake_case"];
		} else if (id.startsWith("__")) {
			return [
				false,
				"IDs starting with double underscore are reserved for injected groups",
			];
		}

		const goodModes = ["buttons", "menu"];
		if (!goodModes.includes(mode)) {
			return [
				false,
				"Invalid mode: may only be one of " + goodModes.join("/"),
			];
		}

		message = message.replace(/\\n/g, "\n");

		if (!validMinAndMaxValues(minValues, maxValues)) {
			return [
				false,
				"Minimum and maximum number of options must be between 0 and 25 and min<=max",
			];
		}

		if (!channel.isTextBased()) {
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
						minValues,
						maxValues,
						channelId: channel.id,
					},
				})
			).id,
		];
	} catch (e) {
		logger.error(e, "Error while creating role selection group");
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
		logger.error(e, "Error while deleting role selection group");
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
		logger.error(e, "Error while editing role selection group");
		return "Something went wrong; possibly, no role group was found with that ID";
	}
}

async function setNumGroup(
	prisma: PrismaClient,
	id: string,
	minValues: number,
	maxValues: number
): Promise<true | string> {
	try {
		if (!id.match(/^[a-z0-9_]+$/)) {
			return "Invalid id: must be snake_case";
		}

		if (!validMinAndMaxValues(minValues, maxValues)) {
			return "Minimum and maximum number of options must be between 0 and 25 and min<=max";
		}

		await prisma.roleGroup.update({
			where: { id },
			data: { minValues, maxValues },
		});

		return true;
	} catch (e) {
		logger.error(
			e,
			"Error while setting maximum/minimum number of options of role selection group"
		);
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

		if (!channel.isTextBased()) {
			return "Invalid channel: must be a text channel";
		}

		await prisma.roleGroup.update({
			where: { id },
			data: { channelId: channel.id },
		});

		return true;
	} catch (e) {
		logger.error(e, "Error while moving role selection group");
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
			const embed = new Discord.EmbedBuilder().setTitle(
				"Role Group Information"
			).setDescription(`**ID**: ${group.id}
				**Mode:** ${group.mode}
				**Placeholder:** ${group.placeholder}
				**Message:** ${group.message}
				**Value Constraints:** Min ${group.minValues}, Max ${group.maxValues}
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
				embed.addFields({
					name: (opt.emoji ? opt.emoji + " " : "") + opt.label,
					value: opt.value + " - " + opt.description,
					inline: true,
				});
			}

			return {
				embeds: [embed],
			};
		} else {
			return `No group was found with ID \`${id}\``;
		}
	} catch (e) {
		logger.error(e, "Error while viewing role selection group");
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
		logger.error(e, "Error while adding option to role selection group");
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
		logger.error(
			e,
			"Error while removing option from role selection group"
		);
		return "Something went wrong";
	}
}

// TODO: dry this a bit
export async function handleCommand(
	interaction: Discord.ChatInputCommandInteraction,
	prisma: PrismaClient
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
						interaction.options.getInteger("min", false) ?? 1,
						interaction.options.getInteger("max", false) ?? 1,
						interaction.options.getChannel(
							"channel",
							true
						) as Discord.GuildChannel
						// FIXME: I've no clue what a APIInteractionDataResolvedChannel is
						// so I'm ignoring the possibility of it even existing
					);
					if (succ) {
						logger.info({ res }, "Created role selection group");
						await interaction.editReply(
							utils.CheckMarkEmoji +
								`Role selection group \`${res}\` successfully created.`
						);
					} else {
						logger.error(
							{ res },
							"Failed to create role selection group"
						);
						await interaction.editReply(
							utils.XEmoji +
								`Could not create group because: **${res}**`
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
						logger.info({ id }, "Deleted role selection group");
						await interaction.editReply(
							utils.CheckMarkEmoji +
								`Role selection group \`${id}\` successfully deleted.`
						);
					} else {
						logger.error(
							{ res },
							"Failed to delete role selection group"
						);
						await interaction.editReply(
							utils.XEmoji +
								`Could not delete group because: **${res}**`
						);
					}
					break;
				}
				case "edit": {
					const id = interaction.options.getString("id", true);
					const name = interaction.options.getString("name", true);
					const value = interaction.options.getString("value", true);
					const res = await editGroup(prisma, id, name, value);

					if (res === true) {
						logger.info(
							{ id, name, value },
							"Edited role selection group"
						);
						await interaction.editReply(
							utils.CheckMarkEmoji +
								`Role selection group \`${id}\` successfully edited.`
						);
					} else {
						logger.info(
							{ id, name, value, res },
							"Error while editing role selection group"
						);
						await interaction.editReply(
							utils.XEmoji +
								`Could not edit group because: **${res}**`
						);
					}
					break;
				}
				case "set-num": {
					const id = interaction.options.getString("id", true);
					const min = interaction.options.getInteger("min", true);
					const max = interaction.options.getInteger("max", true);
					const res = await setNumGroup(prisma, id, min, max);
					if (res === true) {
						logger.info(
							{ id, min, max },
							"Set minimum/maximum of option selections for role selection group"
						);
						await interaction.editReply(
							utils.CheckMarkEmoji +
								`Role selection group \`${id}\` successfully edited.`
						);
					} else {
						logger.info(
							{ id, min, max, res },
							"Error while setting minimum/maximum of option selections for role selection group"
						);
						await interaction.editReply(
							utils.XEmoji +
								`Could not edit group because: **${res}**`
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
						logger.info(
							{ id, channel },
							"Moved role selection group"
						);
						await interaction.editReply(
							utils.CheckMarkEmoji +
								`Role selection group \`${id}\` successfully moved to <#${channel.id}>.`
						);
					} else {
						logger.info(
							{ id, channel, res },
							"Error while moving role selection group"
						);
						await interaction.editReply(
							utils.XEmoji +
								`Could not move group because: **${res}**`
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
								new Discord.EmbedBuilder()
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
						logger.error(e, "Could not list role groups");
						await interaction.editReply(
							utils.XEmoji + "Failed to list role groups."
						);
					}
					break;
				}
			}
			break;
		case "options":
			switch (subCommand) {
				case "add": {
					const groupId = interaction.options.getString(
						"group-id",
						true
					);
					const label = interaction.options.getString("label", true);
					const description = interaction.options.getString(
						"description",
						true
					);
					const role = interaction.options.getRole(
						"role",
						true
					) as Discord.Role;
					const emoji = interaction.options.getString("emoji", false);
					const res = await addOption(
						prisma,
						groupId,
						label,
						description,
						role,
						emoji
					);
					if (res === true) {
						logger.info(
							{ groupId, label, description, role, emoji },
							"Added option to role selection group"
						);
						await interaction.editReply(
							utils.CheckMarkEmoji + "Option successfully added."
						);
					} else {
						logger.error(
							{ groupId, label, description, role, emoji, res },
							"Error while adding option to role selection group"
						);
						await interaction.editReply(
							utils.XEmoji +
								`Could not add option because: **${res}**`
						);
					}
					break;
				}
				case "remove": {
					const groupId = interaction.options.getString(
						"group-id",
						true
					);
					const label = interaction.options.getString("label", true);
					const res = await removeOption(prisma, groupId, label);
					if (res === true) {
						logger.info(
							{ groupId, label },
							"Removed option from role selection group"
						);
						await interaction.editReply(
							utils.CheckMarkEmoji +
								"Option successfully removed."
						);
					} else {
						logger.error(
							{ groupId, label, res },
							"Error while removing option from role selection group"
						);
						await interaction.editReply(
							utils.XEmoji +
								`Could not remove option because: **${res}**`
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
						const editExisting = interaction.options.getBoolean(
							"edit-existing",
							true
						);
						await sendRoleSelectionMessages(
							interaction.client,
							prisma,
							editExisting
						);

						logger.info(
							{ editExisting },
							"Sent messages for all role selection groups"
						);
						await interaction.editReply(
							utils.CheckMarkEmoji +
								"Role selection messages successfully sent."
						);
					} catch (e) {
						logger.error(
							e,
							"Could not send role selection messages"
						);
						await interaction.editReply(
							utils.XEmoji +
								"Failed to send role selection messages."
						);
					}
					break;
				}
			}
			break;
		case "tourist":
			switch (subCommand) {
				case "set-info":
					try {
						const field = interaction.options.getString(
							"field",
							true
						);
						const value = interaction.options
							.getString("value", true)
							.replace(/\\n/g, "\n");

						if (!["message", "label"].includes(field)) {
							await interaction.editReply(
								utils.XEmoji + "Invalid name."
							);
						}

						const fqkey = `tourist:${field}`;

						await prisma.config.upsert({
							where: { key: fqkey },
							update: { value },
							create: { key: fqkey, value },
						});

						logger.info({ field, value }, "Set tourist info");
						await interaction.editReply(
							utils.CheckMarkEmoji +
								`Successfully set TourIST ${field}.`
						);
					} catch (e) {
						logger.error(e, "Failed to set tourist info");
						await interaction.editReply(
							utils.XEmoji + "Failed to set TourIST info."
						);
					}
					break;
				case "move":
					try {
						const channel = interaction.options.getChannel(
							"channel",
							true
						) as Discord.GuildChannel;

						if (!channel.isTextBased() && !channel.isThread()) {
							await interaction.editReply(
								utils.XEmoji + "Invalid channel."
							);
						}

						const fqkey = `tourist:channel_id`;

						await prisma.config.upsert({
							where: { key: fqkey },
							update: { value: channel.id },
							create: { key: fqkey, value: channel.id },
						});

						logger.info({ channel }, "Set tourist channel");
						await interaction.editReply(
							utils.CheckMarkEmoji +
								`Successfully set TourIST channel.`
						);
					} catch (e) {
						logger.error(e, "Failed to set tourist channel");
						await interaction.editReply(
							utils.XEmoji + "Failed to set TourIST channel."
						);
					}
					break;
				case "set-role":
					try {
						const role = interaction.options.getRole(
							"role",
							true
						) as Discord.Role;

						const fqkey = `tourist:role_id`;

						await prisma.config.upsert({
							where: { key: fqkey },
							update: { value: role.id },
							create: { key: fqkey, value: role.id },
						});

						logger.info({ role }, "Set tourist role");
						await interaction.editReply(
							utils.CheckMarkEmoji +
								"Successfully set TourIST role."
						);
					} catch (e) {
						logger.error(e, "Error while setting tourist role");
						await interaction.editReply(
							utils.XEmoji + "Failed to set TourIST role."
						);
					}
					break;
				case "info":
					try {
						const getConfig = getConfigFactory(prisma, "tourist");
						const message =
							(await getConfig("message")) ?? "[UNSET]";
						const label = (await getConfig("label")) ?? "[UNSET]";
						const channel = await getConfig("channel_id");
						const role = await getConfig("role_id");
						const msgId = await getConfig("message_id");

						const embed = new Discord.EmbedBuilder()
							.setTitle("TourIST Information")
							.addFields({ name: "Message", value: message })
							.addFields({ name: "Label", value: label })
							.addFields({
								name: "Channel",
								value: channel ? `<#${channel}>` : "[UNSET]",
							})
							.addFields({
								name: "Role",
								value: role ? `<@&${role}>` : "[UNSET]",
							})
							.addFields({
								name: "Location",
								value:
									channel && msgId
										? `[Here](https://discord.com/channels/${process.env.GUILD_ID}/${channel}/${msgId})`
										: "[UNSET]",
							});
						await interaction.editReply({ embeds: [embed] });
					} catch (e) {
						logger.error(e, "Error while getting tourist info");
						await interaction.editReply(
							utils.XEmoji + "Something went wrong."
						);
					}

					break;
			}
			break;
	}
}
