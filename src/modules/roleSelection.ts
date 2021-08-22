// Handler for role selection

import { PrismaClient } from "@prisma/client";
import Discord, { MessageSelectOptionData } from "discord.js";
import * as utils from "./utils";

// TODO: eventually, this should all be read from the database
// TODO: load from fénix
// TODO: try emoji: "id"
/*const SELECTABLE_ROLE_GROUPS = [
	[
		{
			id: "degree",
			mode: "menu",
			placeholder: "Escolhe o teu curso",
			options: [
				{
					label: "LEIC-A",
					description:
						"Licenciatura em Engenharia Informática e de Computadores - Alameda",
					value: "876961096253206542",
				},
				{
					label: "LEIC-T",
					description:
						"Licenciatura em Engenharia Informática e de Computadores - Taguspark",
					value: "876961212590587914",
				},
				{
					label: "LEFT",
					description:
						"Licenciatura em Engenharia Física e Tecnológica",
					value: "876961271667372073",
				},
			] as Discord.MessageSelectOptionData[],
		},
	],
] as [RoleGroup?, RoleGroup?, RoleGroup?, RoleGroup?, RoleGroup?][];*/

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
							(group.options as MessageSelectOptionData[]).map(
								(o) => {
									o.emoji = "😄";
									return o;
								}
							)
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
