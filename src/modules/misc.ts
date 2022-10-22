// Misc. logic that doesn't fit elsewhere

import * as fs from "fs";

import * as Discord from "discord.js";
import * as Builders from "@discordjs/builders";

import { CommandDescriptor } from "../bot.d";
import { CommandPermission } from "../bot";
import * as utils from "./utils";
import logger from "../logger";

export function provideCommands(): CommandDescriptor[] {
	const say = new Builders.SlashCommandBuilder()
		.setName("say")
		.setDescription("Sends a message to a channel");
	say.addStringOption(
		new Builders.SlashCommandStringOption()
			.setName("message")
			.setDescription("What message to send")
			.setRequired(true)
	);
	say.addChannelOption(
		new Builders.SlashCommandChannelOption()
			.setName("channel")
			.setDescription("Where to send the message; defaults to current")
			.setRequired(false)
	);
	say.addBooleanOption(
		new Builders.SlashCommandBooleanOption()
			.setName("allow-mentions")
			.setDescription(
				"Whether to allow mentions in the message; defaults to false"
			)
			.setRequired(false)
	);
	const whoSaid = new Builders.SlashCommandBuilder()
		.setName("who-said")
		.setDescription("Shows who ordered the bot to say something");
	whoSaid.addStringOption(
		new Builders.SlashCommandStringOption()
			.setName("message-id")
			.setDescription("Message ID in question")
			.setRequired(true)
	);
	const migrateMembersWithRole = new Builders.SlashCommandBuilder()
		.setName("migrate-members-with-role")
		.setDescription("Gives a role to everyone who has a certain role");
	migrateMembersWithRole.addRoleOption(
		new Builders.SlashCommandRoleOption()
			.setName("old-role")
			.setDescription("The role to migrate members from")
			.setRequired(true)
	);
	migrateMembersWithRole.addRoleOption(
		new Builders.SlashCommandRoleOption()
			.setName("new-role")
			.setDescription("The role to migrate members to")
			.setRequired(true)
	);
	migrateMembersWithRole.addBooleanOption(
		new Builders.SlashCommandBooleanOption()
			.setName("remove-old")
			.setDescription("Whether to remove the old role")
			.setRequired(false)
	);
	return [
		{
			builder: new Builders.SlashCommandBuilder()
				.setName("about")
				.setDescription("Show general and version information"),
			handler: handleAboutCommand,
			permission: CommandPermission.Public,
		},
		{
			builder: say,
			handler: handleSayCommand,
		},
		{
			builder: whoSaid,
			handler: handleWhoSaidCommand,
		},
		{
			builder: new Builders.SlashCommandBuilder()
				.setName("just-ask")
				.setDescription(
					'Send a link to the "Don\'t ask to ask" website'
				),
			handler: handleJustAskSlashCommand,
			permission: CommandPermission.Public,
		},
		{
			builder: new Builders.ContextMenuCommandBuilder()
				.setName("Just Ask")
				.setType(Discord.ApplicationCommandType.Message),
			handler: handleJustAskContextMenuCommand,
			permission: CommandPermission.Public,
		},
		{
			builder: migrateMembersWithRole,
			handler: handleMigrateMembersWithRole,
		},
	];
}

export async function handleAboutCommand(
	interaction: Discord.CommandInteraction
): Promise<void> {
	let pkg: Record<string, string>;
	try {
		pkg = JSON.parse(
			fs.readFileSync(__dirname + "/../../package.json").toString()
		);
	} catch (e) {
		pkg = {};
	}
	const pvar = (v: string, fallback = "[unknown]") => pkg[v] ?? fallback;

	// cannot easily import so reading it directly
	await interaction.editReply({
		embeds: [
			new Discord.EmbedBuilder()
				.setTitle("IST Discord Bot")
				.setURL(pvar("homepage", "https://discord.leic.pt"))
				.setAuthor({ name: pvar("author") })
				.setDescription(
					`**Description:** ${pvar("description")}
				**Version:** ${pvar("version")}
				**License:** ${pvar("license")}
				**Authors:**`
				)
				.addFields(
					[
						["Rafael Oliveira", "RafDevX"],
						["Diogo Correia", "diogotcorreia"],
						["Luís Fonseca", "luishfonseca"],
					].map((a) => ({
						name: a[0],
						value: "[GitHub](https://github.com/" + a[1] + ")",
						inline: true,
					}))
				)
				.setFooter({
					text:
						"Uptime: " +
						utils.durationString(interaction.client.uptime ?? 0),
				}),
		],
	});
}

const sayLogs: Discord.Collection<string, string> = new Discord.Collection();

export async function handleSayCommand(
	interaction: Discord.ChatInputCommandInteraction
): Promise<void> {
	try {
		const channel = (interaction.options.getChannel("channel", false) ||
			interaction.channel) as Discord.GuildChannel | null;
		const message = interaction.options.getString("message", true);
		const allowMentions =
			interaction.options.getBoolean("allow-mentions", false) ?? false;

		if (channel && channel.isTextBased()) {
			const msg = await channel.send({
				content: message.replace(/\\n/g, "\n"),
				allowedMentions: allowMentions ? undefined : { parse: [] },
			});
			const uid = interaction.member?.user.id;
			if (uid) {
				sayLogs.set(msg.id, uid);
				logger.info(
					{
						user: interaction.member?.user.username,
						message,
						allowMentions,
					},
					"User used /say command"
				);
			}
			await interaction.editReply(
				utils.CheckMarkEmoji + "Successfully sent message."
			);
			return;
		}
		throw new Error("???");
	} catch (e) {
		logger.error(e, "Failed to send message through /say");
		await interaction.editReply(utils.XEmoji + "Something went wrong.");
	}
}

export async function handleWhoSaidCommand(
	interaction: Discord.ChatInputCommandInteraction
): Promise<void> {
	try {
		const messageId = interaction.options.getString("message-id", true);
		const split = messageId.split("-");
		const who = sayLogs.get(split[split.length - 1]);

		if (who) {
			await interaction.editReply(`<@${who}> said it!`);
		} else {
			await interaction.editReply("I don't know who said it...");
		}
	} catch (e) {
		logger.error(e, "Error while handling Who Said command");
		await interaction.editReply(
			utils.XEmoji + "Something went wrong, maybe wrong message ID?"
		);
	}
}

export async function sendJustAsk(
	interaction: Discord.CommandInteraction,
	sender: (
		...args: Parameters<typeof Discord.Message.prototype.reply>
	) => Promise<Discord.Message | undefined> // to allow optional chaining (?.)
): Promise<void> {
	try {
		const msg = await sender("https://dontasktoask.com/");
		if (!msg) {
			throw new Error("Failed to send message");
		}
		sayLogs.set(msg.id, interaction.user.id);
		await interaction.editReply(utils.CheckMarkEmoji + "Sent");
		logger.info({ member: interaction.member }, "Used don't ask to ask");
	} catch (e) {
		logger.error(e, "Error while executing just ask command");
		await interaction.editReply(utils.XEmoji + "Something went wrong.");
	}
}

export async function handleJustAskSlashCommand(
	interaction: Discord.ChatInputCommandInteraction
): Promise<void> {
	if (interaction.channel) {
		await sendJustAsk(
			interaction,
			async (...args) => await interaction.channel?.send(...args)
		);
	}
}

export async function handleJustAskContextMenuCommand(
	interaction: Discord.ContextMenuCommandInteraction
): Promise<void> {
	if (interaction.isMessageContextMenuCommand()) {
		await sendJustAsk(
			interaction,
			async (...args) => await interaction.targetMessage?.reply(...args)
		);
	}
}

export async function handleMigrateMembersWithRole(
	interaction: Discord.ChatInputCommandInteraction
): Promise<void> {
	try {
		const oldRole = interaction.options.getRole(
			"old-role",
			true
		) as Discord.Role;
		const newRole = interaction.options.getRole(
			"new-role",
			true
		) as Discord.Role;
		const removeOld = interaction.options.getBoolean("remove-old", false);

		// fetch all members, otherwise oldRole.members will be empty
		await interaction.guild?.members.fetch();

		let count = 0;
		for (const [_, member] of oldRole.members) {
			await member.roles.add(newRole);

			if (removeOld) {
				await member.roles.remove(oldRole);
			}

			count++;
		}

		logger.info(
			{ oldRole, newRole, count, removeOld },
			"Migrated members from role to role"
		);
		await interaction.editReply(
			utils.CheckMarkEmoji +
				`Migrated ${count} members from ${oldRole} to ${newRole}`
		);
	} catch (e) {
		logger.error(e, "Error while migrating members to new role");
		await interaction.editReply(utils.XEmoji + "Something went wrong.");
	}
}
