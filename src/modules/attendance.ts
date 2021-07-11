import { AttendancePoll, ScheduledAttendancePoll } from "./attendance.d";
import {
	ButtonInteraction,
	Client,
	Message,
	MessageButton,
	MessageEmbed,
	Snowflake,
	TextChannel,
} from "discord.js";
import * as cron from "node-cron";

const ATTENDANCE_POLL_MSG = "Attendance Poll";
const ATTENDANCE_POLL_BUTTONS = [
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
];
const ATTENDANCE_NO_ONE = "*No one*";

export const handleAttendanceButton = async (
	interaction: ButtonInteraction
): Promise<void> => {
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
		components: [ATTENDANCE_POLL_BUTTONS],
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
		components: [ATTENDANCE_POLL_BUTTONS],
	});

	await message.pin();
};

export const scheduleAttendancePolls = async (
	client: Client,
	polls: ScheduledAttendancePoll[]
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

			cron.schedule(poll.cron, () =>
				sendAttendanceEmbed(poll, channel as TextChannel)
			);
		})
	);
};
