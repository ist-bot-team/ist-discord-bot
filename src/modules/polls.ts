// Handler for polls

import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ChatInputCommandInteraction,
	Client,
	Embed,
	EmbedBuilder,
	Snowflake,
	TextChannel,
} from "discord.js";
import * as Builders from "@discordjs/builders";
import cron from "node-cron";

import { PrismaClient, Poll } from "@prisma/client";
import { CommandDescriptor } from "../bot.d";
import * as utils from "./utils";
import logger from "../logger";

const POLL_ACTION_ROW = new ActionRowBuilder<ButtonBuilder>().addComponents([
	new ButtonBuilder()
		.setLabel("Yes")
		.setStyle(ButtonStyle.Success)
		.setCustomId("polls:yes"),
	new ButtonBuilder()
		.setLabel("No")
		.setStyle(ButtonStyle.Danger)
		.setCustomId("polls:no"),
	new ButtonBuilder()
		.setLabel("Clear")
		.setStyle(ButtonStyle.Secondary)
		.setCustomId("polls:clear"),
]);
const POLL_NO_ONE = "*No one*";

export const handlePollButton = async (
	interaction: ButtonInteraction
): Promise<void> => {
	await interaction.deferReply({ ephemeral: true });

	const action = interaction.customId.split(":")[1];
	let fieldIndex = -1;

	const oldEmbeds = interaction.message.embeds;

	if (action === "yes") {
		fieldIndex = 0;
	} else if (action === "no") {
		fieldIndex = 1;
	}

	const newEmbed = getNewPollEmbed(
		oldEmbeds[0] as Embed,
		fieldIndex,
		interaction.user.id
	);

	interaction.message.edit({
		embeds: [newEmbed],
		components: [POLL_ACTION_ROW],
	});

	await interaction.editReply("Response recorded!");
};

export const getNewPollEmbed = (
	oldEmbed: Embed,
	fieldIndex: number,
	userId: Snowflake
): Embed => {
	oldEmbed.fields?.map((field, i) => {
		field.value =
			field.value
				.split("\n")
				.filter(
					(user) => user !== POLL_NO_ONE && user !== `<@${userId}>`
				)
				.join("\n") || (fieldIndex === i ? "" : POLL_NO_ONE);
	});
	if (oldEmbed.fields[fieldIndex])
		oldEmbed.fields[
			fieldIndex
		].value = `${oldEmbed.fields[fieldIndex]?.value}\n<@${userId}>`;

	return oldEmbed;
};

export const unpinPoll = async (
	poll: Poll,
	channel: TextChannel
): Promise<void> => {
	const pinnedMessages = await channel.messages.fetchPinned();
	await Promise.all(
		pinnedMessages.map((msg) => {
			if (
				msg.embeds?.some(
					(msgEmbed) => msgEmbed.footer?.text === poll.id
				)
			)
				return msg.unpin();
		})
	);
};

export const sendPollEmbed = async (
	poll: Poll,
	channel: TextChannel
): Promise<void> => {
	await unpinPoll(poll, channel);

	const message = await channel.send({
		embeds: [
			new EmbedBuilder()
				.setTitle(poll.title)
				.addFields({ name: "Yes", value: POLL_NO_ONE, inline: true })
				.addFields({ name: "No", value: POLL_NO_ONE, inline: true })
				.setFooter({ text: poll.id })
				.setTimestamp(),
		],
		components: [POLL_ACTION_ROW],
	});

	await message.pin();
};

export const schedulePolls = async (
	client: Client,
	prisma: PrismaClient,
	polls: (Poll & { cron: string })[]
): Promise<void> => {
	await Promise.all(
		polls.map(async (poll) => {
			const channel = await client.channels.fetch(
				poll.channelId as Snowflake
			);

			if (!channel) {
				logger.error(
					{ channel: poll.channelId, poll: poll.id },
					"Couldn't fetch channel for poll"
				);
				return;
			}

			cron.schedule(poll.cron, async () => {
				try {
					// make sure it wasn't deleted / edited in the meantime
					const p = await prisma.poll.findFirst({
						where: { id: poll.id },
					});
					if (p !== null) {
						await sendPollEmbed(p, channel as TextChannel);
					}
				} catch (e) {
					logger.error(e, "Could not verify (& send) poll");
				}
			});
		})
	);
};

export const scheduleAllScheduledPolls = async (
	client: Client,
	prisma: PrismaClient
): Promise<void> => {
	await schedulePolls(
		client,
		prisma,
		(await prisma.poll.findMany({
			where: {
				type: "scheduled",
			},
		})) as (Poll & { cron: string })[]
	);
};

export function provideCommands(): CommandDescriptor[] {
	const cmd = new Builders.SlashCommandBuilder()
		.setName("poll")
		.setDescription("Manage polls");
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("add")
			.setDescription("Create a new poll")
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("id")
					.setDescription("Unique identifier")
					.setRequired(true)
			)
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("title")
					.setDescription("Poll title")
					.setRequired(true)
			)
			.addChannelOption(
				new Builders.SlashCommandChannelOption()
					.setName("channel")
					.setDescription("Where polls will be sent")
					.setRequired(true)
			)
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("schedule")
					.setDescription(
						"Cron schedule string; BE VERY CAREFUL THIS IS CORRECT! If none, send one-shot poll."
					)
					.setRequired(false)
			)
	);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("remove")
			.setDescription("Remove an existing poll")
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("id")
					.setDescription("Unique identifier")
					.setRequired(true)
			)
	);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("list")
			.setDescription("List existing polls")
	);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("info")
			.setDescription("Get information for an existing poll")
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("id")
					.setDescription("Unique identifier")
					.setRequired(true)
			)
	);
	return [{ builder: cmd, handler: handleCommand }];
}

export async function handleCommand(
	interaction: ChatInputCommandInteraction,
	prisma: PrismaClient
): Promise<void> {
	switch (interaction.options.getSubcommand()) {
		case "add": {
			try {
				const id = interaction.options.getString("id", true);
				const title = interaction.options.getString("title", true);
				const channel = interaction.options.getChannel("channel", true);
				const cron = interaction.options.getString("schedule", false);

				const poll = await prisma.poll.create({
					data: {
						id,
						type: cron ? "scheduled" : "one-shot",
						title,
						cron,
						channelId: channel.id,
					},
				});

				if (cron) {
					await schedulePolls(interaction.client, prisma, [
						poll as Poll & { cron: string },
					]);
				} else {
					await sendPollEmbed(poll, channel as TextChannel);
				}

				await interaction.editReply(
					utils.CheckMarkEmoji +
						`Successfully added${cron ? " and scheduled" : ""}.`
				);
			} catch (e) {
				await interaction.editReply(
					utils.XEmoji +
						"Something went wrong, maybe the ID already exists?"
				);
			}

			break;
		}
		case "remove": {
			try {
				const id = interaction.options.getString("id", true);

				const p = (await prisma.poll.findFirst({
					where: { id },
				})) as Poll;
				const channel = (await interaction.client.channels.fetch(
					p.channelId as Snowflake
				)) as TextChannel;
				await unpinPoll(p, channel);

				await prisma.poll.delete({ where: { id } });

				await interaction.editReply(
					utils.CheckMarkEmoji + "Successfully removed."
				);
			} catch (e) {
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}

			break;
		}
		case "list": {
			try {
				const polls = await prisma.poll.findMany();
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle("Polls")
							.setDescription(
								polls.length
									? "Below is a list of all polls with their title and ID"
									: "No polls found"
							)
							.addFields(
								polls.map((p) => ({
									name: p.title,
									value: p.id,
									inline: true,
								}))
							),
					],
				});
			} catch (e) {
				await interaction.editReply(
					utils.XEmoji + "Something went wrong."
				);
			}

			break;
		}
		case "info": {
			try {
				const id = interaction.options.getString("id", true);

				const poll = await prisma.poll.findFirst({
					where: { id },
				});

				if (poll === null) {
					await interaction.editReply(
						utils.XEmoji + "No poll found with that ID."
					);
				} else {
					await interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setTitle("Poll Information")
								.addFields({
									name: "ID",
									value: poll.id,
									inline: true,
								})
								.addFields({
									name: "Type",
									value: poll.type,
									inline: true,
								})
								.addFields({
									name: "Title",
									value: poll.title,
									inline: true,
								})
								.addFields({
									name: "Schedule",
									value: poll.cron ? poll.cron : "N/A",
									inline: true,
								})
								.addFields({
									name: "Channel",
									value: `<#${poll.channelId}>`,
									inline: true,
								}),
						],
					});
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
