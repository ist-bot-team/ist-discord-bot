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

const POLL_MSG = "Poll";
const POLL_ACTION_ROW = new MessageActionRow();
POLL_ACTION_ROW.addComponents([
	new MessageButton()
		.setLabel("Yes")
		.setStyle("SUCCESS")
		.setCustomId("poll:yes"),
	new MessageButton()
		.setLabel("No")
		.setStyle("DANGER")
		.setCustomId("poll:no"),
	new MessageButton()
		.setLabel("Clear")
		.setStyle("SECONDARY")
		.setCustomId("poll:clear"),
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
		content: POLL_MSG,
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

export const sendPollEmbed = async (
	embed: Poll,
	channel: TextChannel
): Promise<void> => {
	const pinnedMessages = await channel.messages.fetchPinned();
	await Promise.all(
		pinnedMessages.map((msg) => {
			if (
				msg.embeds?.some(
					(msgEmbed) => msgEmbed.footer?.text === embed.id
				)
			)
				return msg.unpin();
		})
	);

	const message = await channel.send({
		content: POLL_MSG,
		embeds: [
			new MessageEmbed()
				.setTitle(embed.title)
				.addField("Yes", POLL_NO_ONE, true)
				.addField("No", POLL_NO_ONE, true)
				.setFooter(embed.id)
				.setTimestamp(),
		],
		components: [POLL_ACTION_ROW],
	});

	await message.pin();
};

export const schedulePolls = async (
	client: Client,
	prisma: PrismaClient,
	polls: Poll[]
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
					console.error("Could not verify (& send) poll:", e.message);
				}
			});
		})
	);
};

export function provideCommands(): CommandDescriptor[] {
	const cmd = new Builders.SlashCommandBuilder()
		.setName("poll")
		.setDescription("Manage polls");
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("add")
			.setDescription("Create a new scheduled poll")
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
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("cron")
					.setDescription(
						"Cron schedule string; BE VERY CAREFUL THIS IS CORRECT!"
					)
					.setRequired(true)
			)
			.addChannelOption(
				new Builders.SlashCommandChannelOption()
					.setName("channel")
					.setDescription("Where polls will be sent")
					.setRequired(true)
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
				const cron = interaction.options.getString("cron", true);
				const channel = interaction.options.getChannel("channel", true);

				// TODO: don't take this at face value
				// ^ how important is this? in principle admins won't mess up

				const poll = await prisma.poll.create({
					data: {
						id,
						type: "scheduled",
						title,
						cron,
						channelId: channel.id,
					},
				});

				await schedulePolls(interaction.client, prisma, [poll]);

				await interaction.editReply(
					"✅ Successfully added and scheduled."
				);
			} catch (e) {
				await interaction.editReply(
					"❌ Something went wrong, maybe the ID already exists?"
				);
			}

			break;
		}
		case "remove": {
			try {
				const id = interaction.options.getString("id", true);

				await prisma.poll.delete({ where: { id } });

				await interaction.editReply("✅ Successfully removed.");
			} catch (e) {
				await interaction.editReply("❌ Something went wrong.");
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
								polls.map((p: Poll) => ({
									name: p.title,
									value: p.id,
									inline: true,
								}))
							),
					],
				});
			} catch (e) {
				await interaction.editReply("❌ Something went wrong.");
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
						"❌ No poll found with that ID."
					);
				} else {
					await interaction.editReply({
						embeds: [
							new MessageEmbed()
								.setTitle("Poll Information")
								.addField("ID", poll.id, true)
								.addField("Type", poll.type, true)
								.addField("Title", poll.title, true)
								.addField("Cron Schedule", poll.cron, true)
								.addField(
									"Channel",
									`<#${poll.channelId}>`,
									true
								),
						],
					});
				}
			} catch (e) {
				await interaction.editReply("❌ Something went wrong.");
			}

			break;
		}
	}
}
