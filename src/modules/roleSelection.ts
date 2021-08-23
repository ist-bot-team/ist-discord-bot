// Handler for role selection

import { PrismaClient } from "@prisma/client";
import Discord from "discord.js";
import * as utils from "./utils";

const MAX_COMPONENTS_PER_ROW = 5;
const MAX_ROWS_PER_MESSAGE = 5;

// TODO: load from fénix into database

export async function sendRoleSelectionMessages(
	client: Discord.Client,
	prisma: PrismaClient
): Promise<void> {
	const groups = await prisma.roleGroup.findMany({
		include: { options: true },
	});
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

					await prisma.roleGroup.update({
						where: { id: group.id },
						data: { messageId: msg.id },
					});
				}
			}
		} catch (e) {
			console.error(
				`Could not send role selection message for group ${group.id} because: ${e.message}`
			);
		}
	}
}

export async function handleRoleSelectionMenu(
	interaction: Discord.SelectMenuInteraction,
	prisma: PrismaClient
): Promise<void> {
	await interaction.deferReply({ ephemeral: true });

	const [_prefix, groupId] = utils.getCustomIdComponents(
		interaction.customId
	);
	const groupRoles = (
		await prisma.roleGroup.findMany({ include: { options: true } })
	)
		.filter((g) => g.id === groupId)
		.flatMap((g) => g.options.map((o) => o.value));

	const roles = interaction.member?.roles as Discord.GuildMemberRoleManager;
	const roleToAdd = interaction.values[0];

	try {
		if (groupRoles.includes(roleToAdd)) {
			const rolesToSet = [roleToAdd];
			for (const id of roles.cache.keys()) {
				if (!groupRoles.includes(id)) {
					rolesToSet.push(id);
				}
			}
			await roles.set(rolesToSet);
			await interaction.editReply("Role applied.");
		} else {
			throw new Error("Role not in group");
		}
	} catch (e) {
		await interaction.editReply("Failed to apply role.");
	}
}
