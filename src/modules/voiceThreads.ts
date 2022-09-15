import { ChannelType } from "discord.js";
// Controller for vc-chat threads

import { PrismaClient } from "@prisma/client";
import * as Discord from "discord.js";
import * as Builders from "@discordjs/builders";

import { CommandDescriptor } from "../bot.d";
import * as utils from "./utils";

const VC_CHAT_KEY = "voice_threads:vc_chat";

export function provideCommands(): CommandDescriptor[] {
	const cmd = new Builders.SlashCommandBuilder()
		.setName("voice-threads")
		.setDescription("Manage voice threads");
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("get-vc-chat")
			.setDescription(
				"Shows the currently set VC Chat under which threads will be created"
			)
	);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("set-vc-chat")
			.setDescription(
				"Set under which channel voice threads will be created"
			)
			.addChannelOption(
				new Builders.SlashCommandChannelOption()
					.setName("channel")
					.setDescription("New vc-chat TEXT channel")
					.setRequired(true)
			)
	);
	return [{ builder: cmd, handler: handleCommand }];
}

export async function handleCommand(
	interaction: Discord.ChatInputCommandInteraction,
	prisma: PrismaClient
): Promise<void> {
	switch (interaction.options.getSubcommand()) {
		case "get-vc-chat": {
			try {
				const channel = (
					await prisma.config.findFirst({
						where: { key: VC_CHAT_KEY },
					})
				)?.value;

				if (channel === undefined) {
					await interaction.editReply(
						utils.XEmoji + "No channel is currently set as vc-chat."
					);
				} else {
					await interaction.editReply(
						`Current vc-chat: <#${channel}>`
					);
				}
			} catch (e) {
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}
			break;
		}
		case "set-vc-chat": {
			try {
				const channel = interaction.options.getChannel(
					"channel",
					true
				) as Discord.GuildChannel;

				if (!channel.isTextBased()) {
					await interaction.editReply(
						utils.XEmoji + "Channel must be a text channel."
					);
				} else {
					await prisma.config.upsert({
						where: { key: VC_CHAT_KEY },
						update: { value: channel.id },
						create: {
							key: VC_CHAT_KEY,
							value: channel.id,
						},
					});
					await interaction.editReply(
						utils.CheckMarkEmoji +
							`Successfully set vc-chat to <#${channel.id}>.`
					);
				}
			} catch (e) {
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}
			break;
		}
	}
}

async function fetchVCChat(
	prisma: PrismaClient,
	guild: Discord.Guild
): Promise<Discord.TextChannel | null> {
	const vcChatId = (
		await prisma.config.findFirst({ where: { key: VC_CHAT_KEY } })
	)?.value;
	if (vcChatId === undefined) {
		return null;
	}

	return (await guild.channels.fetch(vcChatId)) as Discord.TextChannel | null;
}

function normalizeVCName(name: string): string {
	return (
		name
			.normalize("NFD")
			.replace(/\p{Diacritic}/gu, "")
			.toLowerCase()
			.replace(/\s/g, "-")
			.replace(/[^a-z0-9-]/g, "")
			.replace(/-{2,}/g, "-") + "-chat"
	);
}

export async function handleVoiceJoin(
	newState: Discord.VoiceState,
	prisma: PrismaClient
): Promise<void> {
	if (newState.channel === null || newState.member === null) {
		return;
	}

	const vcChat = await fetchVCChat(prisma, newState.guild);
	if (vcChat === null) {
		return;
	}

	const threadName = normalizeVCName(newState.channel.name);
	const threadType = newState.guild.features.includes("PRIVATE_THREADS")
		? ChannelType.PrivateThread
		: ChannelType.PublicThread;

	const threads = (await vcChat.threads.fetch()).threads;
	const td = threads.filter(
		(t) => t.type === threadType && t.name === threadName
	);

	const reason = `${newState.member.user.tag} joined voice channel ${newState.channel.name}`;

	if (!td.size) {
		const newThread = await vcChat.threads.create({
			name: threadName,
			autoArchiveDuration: 60,
			type: threadType,
			reason,
		});
		td.set(newThread.id, newThread);
	}
	// can't do td[0] so need to iterate
	for (const [_id, thread] of td) {
		await thread.members.add(
			newState.member as Discord.GuildMember,
			reason
		);
	}
}

export async function handleVoiceLeave(
	oldState: Discord.VoiceState,
	prisma: PrismaClient
): Promise<void> {
	if (oldState.channel === null || oldState.member === null) {
		return;
	}

	const vcChat = await fetchVCChat(prisma, oldState.guild);
	if (vcChat === null) {
		return;
	}

	const threadName = normalizeVCName(oldState.channel.name);
	const threadType = oldState.guild.features.includes("PRIVATE_THREADS")
		? ChannelType.PrivateThread
		: ChannelType.PublicThread;

	const threads = (await vcChat.threads.fetch()).threads;
	const td = threads.filter(
		(t) => t.type === threadType && t.name === threadName
	);

	const removeThread =
		oldState.channel.members.filter(
			(m) => m.id !== oldState.member?.id && !m.user.bot
		).size <= 0;

	// can't do td[0] so need to iterate
	for (const [_id, thread] of td) {
		if (removeThread) {
			await thread.delete(
				`Everyone left voice channel ${oldState.channel.name}`
			);
		} else {
			await thread.members.remove(
				(oldState.member as Discord.GuildMember).id,
				`${oldState.member.user.tag} left voice channel ${oldState.channel.name}`
			);
		}
	}
}
