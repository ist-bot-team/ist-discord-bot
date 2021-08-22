// Handler for role selection

import { PrismaClient } from "@prisma/client";
import Discord from "discord.js";
import * as utils from "./utils";

// TODO: load from fénix into database

export async function sendRoleSelectionMessages(
	channel: Discord.TextChannel,
	prisma: PrismaClient
): Promise<void> {
	const rows = []; // FIXME: this only works up to 5, need a way to separate
	const groups = await prisma.roleGroup.findMany({
		include: { options: true },
	});
	for (const group of groups) {
		if (group.mode === "menu") {
			rows.push(
				new Discord.MessageActionRow().addComponents(
					new Discord.MessageSelectMenu()
						.setCustomId(`roleSelection:${group.id}`)
						.setPlaceholder(group.placeholder)
						.addOptions(
							group.options as Discord.MessageSelectOptionData[]
						)
				)
			);
		}
		await channel.send({ content: "This is a message", components: rows });
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
			await roles.remove(
				roles.cache.filter((r) => groupRoles.includes(r.id))
			);
			await roles.add(roleToAdd);
			await interaction.editReply("Role applied.");
		} else {
			throw new Error("Role not in group");
		}
	} catch (e) {
		await interaction.editReply("Failed to apply role.");
	}
}
