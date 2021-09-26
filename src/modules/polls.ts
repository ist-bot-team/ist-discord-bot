// Handler for polls

import {
	ButtonInteraction,
	Client,
	CommandInteraction,
	Message,
	MessageActionRow,
	MessageButton,
	MessageEmbed,
	Snowflake,
	TextChannel,
} from "discord.js";
import * as Builders from "@discordjs/builders";
import cron from "node-cron";

import { PrismaClient, Poll } from "@prisma/client";
import { CommandDescriptor } from "../bot.d";
import * as utils from "./utils";

const POLL_ACTION_ROW = new MessageActionRow();
POLL_ACTION_ROW.addComponents([
	new MessageButton()
		.setLabel("Yes")
		.setStyle("SUCCESS")
		.setCustomId("polls:yes"),
	new MessageButton()
		.setLabel("No")
		.setStyle("DANGER")
		.setCustomId("polls:no"),
	new MessageButton()
		.setLabel("Clear")
		.setStyle("SECONDARY")
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
		oldEmbeds[0] as MessageEmbed,
		fieldIndex,
		interaction.user.id
	);

	(interaction.message as Message).edit({
		embeds: [newEmbed],
		components: [POLL_ACTION_ROW],
	});

	await interaction.editReply("Response recorded!");
};

export const getNewPollEmbed = (
	oldEmbed: MessageEmbed,
	fieldIndex: number,
	userId: Snowflake
): MessageEmbed => {
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
			new MessageEmbed()
				.setTitle(poll.title)
				.addField("Yes", POLL_NO_ONE, true)
				.addField("No", POLL_NO_ONE, true)
				.setFooter(poll.id)
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
				console.error(
					`Couldn't fetch channel ${poll.channelId} for poll ${poll.id}`
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
					console.error(
						"Could not verify (& send) poll:",
						(e as Error).message
					);
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
	interaction: CommandInteraction,
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
						new MessageEmbed()
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
							new MessageEmbed()
								.setTitle("Poll Information")
								.addField("ID", poll.id, true)
								.addField("Type", poll.type, true)
								.addField("Title", poll.title, true)
								.addField(
									"Schedule",
									poll.cron ? poll.cron : "N/A",
									true
								)
								.addField(
									"Channel",
									`<#${poll.channelId}>`,
									true
								),
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
