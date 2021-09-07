// Handler for attendance polls

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

import { PrismaClient, AttendancePoll } from "@prisma/client";
import { CommandDescriptor } from "../bot.d";

const ATTENDANCE_POLL_MSG = "Attendance Poll";
const ATTENDANCE_POLL_ACTION_ROW = new MessageActionRow();
ATTENDANCE_POLL_ACTION_ROW.addComponents([
	new MessageButton()
		.setLabel("Yes")
		.setStyle("SUCCESS")
		.setCustomId("attendance:yes"),
	new MessageButton()
		.setLabel("No")
		.setStyle("DANGER")
		.setCustomId("attendance:no"),
	new MessageButton()
		.setLabel("Clear")
		.setStyle("SECONDARY")
		.setCustomId("attendance:clear"),
]);
const ATTENDANCE_NO_ONE = "*No one*";

export const handleAttendanceButton = async (
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

	const newEmbed = getNewEmbed(
		oldEmbeds[0] as MessageEmbed,
		fieldIndex,
		interaction.user.id
	);

	(interaction.message as Message).edit({
		content: ATTENDANCE_POLL_MSG,
		embeds: [newEmbed],
		components: [ATTENDANCE_POLL_ACTION_ROW],
	});

	await interaction.reply({ content: "Response recorded!", ephemeral: true });
};

export const getNewEmbed = (
	oldEmbed: MessageEmbed,
	fieldIndex: number,
	userId: Snowflake
): MessageEmbed => {
	oldEmbed.fields?.map((field, i) => {
		field.value =
			field.value
				.split("\n")
				.filter(
					(user) =>
						user !== ATTENDANCE_NO_ONE && user !== `<@${userId}>`
				)
				.join("\n") || (fieldIndex === i ? "" : ATTENDANCE_NO_ONE);
	});
	if (oldEmbed.fields[fieldIndex])
		oldEmbed.fields[
			fieldIndex
		].value = `${oldEmbed.fields[fieldIndex]?.value}\n<@${userId}>`;

	return oldEmbed;
};

export const sendAttendanceEmbed = async (
	embed: AttendancePoll,
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
		content: ATTENDANCE_POLL_MSG,
		embeds: [
			new MessageEmbed()
				.setTitle(embed.title)
				.addField("Attending", ATTENDANCE_NO_ONE, true)
				.addField("Not Attending", ATTENDANCE_NO_ONE, true)
				.setFooter(embed.id)
				.setTimestamp(),
		],
		components: [ATTENDANCE_POLL_ACTION_ROW],
	});

	await message.pin();
};

export const scheduleAttendancePolls = async (
	client: Client,
	prisma: PrismaClient,
	polls: AttendancePoll[]
): Promise<void> => {
	await Promise.all(
		polls.map(async (poll) => {
			const channel = await client.channels.fetch(
				poll.channelId as Snowflake
			);

			if (!channel) {
				console.error(
					`Couldn't fetch channel ${poll.channelId} for attendance poll ${poll.id}`
				);
				return;
			}

			cron.schedule(poll.cron, async () => {
				try {
					// make sure it wasn't deleted / edited in the meantime
					const p = await prisma.attendancePoll.findFirst({
						where: { id: poll.id },
					});
					if (p !== null) {
						await sendAttendanceEmbed(p, channel as TextChannel);
					}
				} catch (e) {
					console.error(
						"Could not verify (& send) attendance poll:",
						e.message
					);
				}
			});
		})
	);
};

export function provideCommands(): CommandDescriptor[] {
	const cmd = new Builders.SlashCommandBuilder()
		.setName("attendance")
		.setDescription("Manage attendance polls");
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("add")
			.setDescription("Create a new scheduled attendance poll")
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("id")
					.setDescription("Unique identifier")
					.setRequired(true)
			)
			.addStringOption(
				new Builders.SlashCommandStringOption()
					.setName("title")
					.setDescription("Attendance poll title")
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
			.setDescription("Remove an existing attendance poll")
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
			.setDescription("List existing attendance polls")
	);
	cmd.addSubcommand(
		new Builders.SlashCommandSubcommandBuilder()
			.setName("info")
			.setDescription("Get information for an existing attendance poll")
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

				const poll = await prisma.attendancePoll.create({
					data: {
						id,
						type: "scheduled",
						title,
						cron,
						channelId: channel.id,
					},
				});

				await scheduleAttendancePolls(interaction.client, prisma, [
					poll,
				]);

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

				await prisma.attendancePoll.delete({ where: { id } });

				await interaction.editReply("✅ Successfully removed.");
			} catch (e) {
				await interaction.editReply("❌ Something went wrong.");
			}

			break;
		}
		case "list": {
			try {
				const polls = await prisma.attendancePoll.findMany();
				await interaction.editReply({
					embeds: [
						new MessageEmbed()
							.setTitle("Attendance Polls")
							.setDescription(
								polls.length
									? "Below is a list of all attendance polls with their title and ID"
									: "No attendance polls found"
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
				await interaction.editReply("❌ Something went wrong.");
			}

			break;
		}
		case "info": {
			try {
				const id = interaction.options.getString("id", true);

				const poll = await prisma.attendancePoll.findFirst({
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
								.setTitle("Attendance Poll Information")
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
