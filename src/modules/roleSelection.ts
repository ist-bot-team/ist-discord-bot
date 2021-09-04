// Handler for role selection

import { PrismaClient } from "@prisma/client";
import Discord from "discord.js";
import { getConfigFactory } from "./utils";
import * as Builders from "@discordjs/builders";

const MAX_COMPONENTS_PER_ROW = 5;
const MAX_ROWS_PER_MESSAGE = 5;

const TOURIST_GROUP_ID = "__tourist"; // must be unique in database
const TOURIST_BUTTON_STYLE = "SECONDARY";

// TODO: load from fénix into database

export async function sendRoleSelectionMessages(
	client: Discord.Client,
	prisma: PrismaClient
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

			if (
				group.messageId === null ||
				!(await channel.messages
					.fetch(group.messageId as string)
					.catch(() => false))
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
					const msg = await (channel as Discord.TextChannel).send({
						content: group.message,
						components,
					});

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

export function provideCommands(): Builders.SlashCommandBuilder[] {
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
							.setDescription("Either 'buttons' or 'menu'")
							.setRequired(true)
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
	);
	return [cmd];
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

export async function handleCommand(
	interaction: Discord.CommandInteraction,
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
			}
			break;
	}
}
