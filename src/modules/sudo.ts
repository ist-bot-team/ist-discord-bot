// Controller for sudo features
// (allows admins to not be overwhelmed by having all permissions at all times)

import * as Discord from "discord.js";
import * as Builders from "@discordjs/builders";

import { CommandDescriptor } from "../bot.d";
import * as utils from "./utils";
import logger from "../logger";

export function provideCommands(): CommandDescriptor[] {
	const sudo = new Builders.SlashCommandBuilder()
		.setName("sudo")
		.setDescription("Toggle enhanced administrator permissions");
	sudo.addUserOption(
		new Builders.SlashCommandUserOption()
			.setName("target")
			.setDescription(
				"Must have permissions to run sudo themselves; defaults to self",
			)
			.setRequired(false),
	);
	return [
		{
			builder: sudo,
			handler: handleSudoCommand,
		},
		{
			builder: new Builders.SlashCommandBuilder()
				.setName("reset-admin")
				.setDescription(
					"Remove enhanced administrator permissions from everyone",
				),
			handler: handleResetAdminCommand,
		},
	];
}

export async function handleSudoCommand(
	interaction: Discord.ChatInputCommandInteraction,
): Promise<void> {
	try {
		const target = interaction.options.getMember("target");

		const roles = (target ?? interaction.member)
			?.roles as Discord.GuildMemberRoleManager;
		const aId = process.env.ADMIN_ID as string;
		const apId = process.env.ADMIN_PLUS_ID as string;

		if (!roles.cache.has(aId) && !roles.cache.has(apId)) {
			await interaction.editReply(
				utils.XEmoji + "User does not have administrator permissions.",
			);
			return;
		}

		if (roles.cache.has(apId)) {
			await roles.remove(apId);
			await interaction.editReply(
				utils.CheckMarkEmoji + "Successfully removed `Admin+` role.",
			);
		} else {
			await roles.add(apId);
			await interaction.editReply(
				utils.CheckMarkEmoji + "Successfully added `Admin+` role.",
			);
		}
	} catch (e) {
		logger.error(e, "Failed to toggle sudo for user");
		await interaction.editReply(
			utils.XEmoji + "Failed to toggle `Admin+` role.",
		);
	}
}

export async function handleResetAdminCommand(
	interaction: Discord.ChatInputCommandInteraction,
): Promise<void> {
	try {
		const role = await (
			await interaction.guild?.fetch()
		)?.roles.cache.get(process.env.ADMIN_PLUS_ID as string);

		if (!role) {
			await interaction.editReply(
				utils.XEmoji + "Could not locate the `Admin+` role",
			);
		}

		role?.members.forEach((member) => member.roles.remove(role));

		await interaction.editReply(
			utils.CheckMarkEmoji + "Successfully reset the `Admin+` role.",
		);
	} catch (e) {
		logger.error(e, "Failed to reset sudo for user");
		await interaction.editReply(
			utils.XEmoji + "Failed to reset the `Admin+` role.",
		);
	}
}
