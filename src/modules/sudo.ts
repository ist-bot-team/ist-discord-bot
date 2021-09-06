// Controller for sudo features
// (allows admins to not be overwhelmed by having all permissions at all times)

import * as Discord from "discord.js";
import * as Builders from "@discordjs/builders";

import { CommandDescriptor } from "../bot.d";

export function provideCommands(): CommandDescriptor[] {
	return [
		{
			command: "sudo",
			builder: new Builders.SlashCommandBuilder()
				.setName("sudo")
				.setDescription("Toggle enhanced administrator permissions"),
			handler: handleSudoCommand,
		},
		{
			command: "reset-admin",
			builder: new Builders.SlashCommandBuilder()
				.setName("reset-admin")
				.setDescription(
					"Remove enhanced administrator permissions from everyone"
				),
			handler: handleResetAdminCommand,
		},
	];
}

export async function handleSudoCommand(
	interaction: Discord.CommandInteraction
): Promise<void> {
	try {
		const roles = interaction.member
			?.roles as Discord.GuildMemberRoleManager;
		const apId = process.env.ADMIN_PLUS_ID as string;

		if (roles.cache.has(apId)) {
			await roles.remove(apId);
			await interaction.editReply(
				"✅ Successfully removed `Admin+` role."
			);
		} else {
			await roles.add(apId);
			await interaction.editReply("✅ Successfully added `Admin+` role.");
		}
	} catch (e) {
		await interaction.editReply("❌ Failed to toggle `Admin+` role.");
	}
}

export async function handleResetAdminCommand(
	interaction: Discord.CommandInteraction
): Promise<void> {
	try {
		const role = await (
			await interaction.guild?.fetch()
		)?.roles.cache.get(process.env.ADMIN_PLUS_ID as string);

		if (!role) {
			await interaction.editReply(
				"❌ Could not locate the `Admin+` role"
			);
		}

		role?.members.forEach((member) => member.roles.remove(role));

		await interaction.editReply("✅ Successfully reset the `Admin+` role.");
	} catch (e) {
		await interaction.editReply("❌ Failed to reset the `Admin+` role.");
	}
}
