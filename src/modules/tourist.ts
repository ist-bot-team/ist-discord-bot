// Handler for the tourIST button
// FIXME: this whole thing needs to somehow be assimilated into the roleSelection module

import { PrismaClient } from "@prisma/client";
import Discord from "discord.js";

const getConfig = async (prisma: PrismaClient, key: string) =>
	(await prisma.config.findFirst({ where: { key: `tourist:${key}` } }))
		?.value;

export async function sendTouristMessage(
	client: Discord.Client,
	prisma: PrismaClient
): Promise<void> {
	const channelId = await getConfig(prisma, "channel_id");
	const messageId = await getConfig(prisma, "message_id");
	const message = await getConfig(prisma, "message");
	const label = await getConfig(prisma, "label");

	const channel = channelId
		? client.channels.cache.find((c) => c.id === channelId)
		: undefined;
	if (channel === undefined || !channel.isText()) {
		throw new Error("Could not find channel");
	} else if (message === undefined) {
		throw new Error("Message not found");
	} else if (label === undefined) {
		throw new Error("Label not found");
	}

	if (
		messageId === null ||
		!(await channel.messages.fetch(messageId as string).catch(() => false))
	) {
		const msg = await (channel as Discord.TextChannel).send({
			content: message,
			components: [
				new Discord.MessageActionRow().addComponents([
					new Discord.MessageButton()
						.setCustomId("tourist:btn")
						.setLabel(label)
						.setStyle(
							"SECONDARY" as Discord.MessageButtonStyleResolvable
						),
				]),
			],
		});

		await prisma.config.upsert({
			where: { key: "tourist:message_id" },
			create: { key: "tourist:message_id", value: msg.id },
			update: { value: msg.id },
		});
	}
}

async function applyTouristRole(
	roles: Discord.GuildMemberRoleManager,
	prisma: PrismaClient
): Promise<boolean> {
	const csv = await getConfig(prisma, "csv");

	if (csv === undefined) {
		return false;
	}

	const [toAdd, ...toRemove] = csv.split(",");

	if (toAdd === undefined) {
		return false;
	}

	try {
		await roles.add(toAdd);
	} catch {
		return false;
	}

	for (const role of toRemove) {
		try {
			await roles.remove(role);
		} catch {
			return false;
		}
	}

	return true;
}

export async function handleRoleSelectionButton(
	interaction: Discord.ButtonInteraction,
	prisma: PrismaClient
): Promise<void> {
	await interaction.deferReply({ ephemeral: true });

	const roles = interaction.member?.roles as Discord.GuildMemberRoleManager;

	if (await applyTouristRole(roles, prisma)) {
		await interaction.editReply("Role applied.");
	} else {
		await interaction.editReply("Failed to apply role.");
	}
}
