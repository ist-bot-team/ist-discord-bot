// Handler for role selection

import { PrismaClient } from "@prisma/client";
import Discord from "discord.js";
import * as utils from "./utils";

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
			if (group.mode === "menu") {
				await (channel as Discord.TextChannel).send({
					content: group.message,
					components: [
						new Discord.MessageActionRow().addComponents(
							new Discord.MessageSelectMenu()
								.setCustomId(`roleSelection:${group.id}`)
								.setPlaceholder(group.placeholder)
								.setMinValues(group.minValues ?? 1) // TODO: db
								.setMaxValues(group.maxValues ?? 1) // TODO: db
								.addOptions(
									group.options as Discord.MessageSelectOptionData[]
								)
						),
					],
				});
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
				if (id !== roleToAdd && groupRoles.includes(id)) {
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
