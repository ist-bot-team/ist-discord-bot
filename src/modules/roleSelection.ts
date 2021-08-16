// Handler for role selection

import Discord from "discord.js";

// TODO: eventually, this should all be read from the database
// TODO: load from fénix
// TODO: try emoji: "id"
const SELECTABLE_ROLE_GROUPS = [
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
				description: "Licenciatura em Engenharia Física e Tecnológica",
				value: "876961271667372073",
			},
		] as Discord.MessageSelectOptionData[],
	},
];

export async function sendRoleSelectionMessages(
	channel: Discord.TextChannel
): Promise<void> {
	const rows = []; // FIXME: this only works up to 5, need a way to separate
	for (const group of SELECTABLE_ROLE_GROUPS) {
		if (group.mode === "menu") {
			rows.push(
				new Discord.MessageActionRow().addComponents(
					new Discord.MessageSelectMenu()
						.setCustomId(`roleSelection:${group.id}`)
						.setPlaceholder(group.placeholder)
						.addOptions(group.options)
				)
			);
		}
		await channel.send({ content: "This is a message", components: rows });
	}
}

export async function handleRoleSelectionMenu(
	interaction: Discord.SelectMenuInteraction
): Promise<void> {
	await interaction.deferReply({ ephemeral: true });

	const roles = interaction.member?.roles as Discord.GuildMemberRoleManager;
	roles.cache.forEach((role) => roles.remove(role)); // FIXME:
	roles.add(interaction.values[0]);

	await interaction.editReply("Role applied.");
}
