// Main controller

import Discord from "discord.js";
import { PrismaClient } from "@prisma/client";

import { MessageComponentInteractionHandler } from "./bot.d";

import * as utils from "./modules/utils";
import * as attendance from "./modules/attendance";
import * as roleSelection from "./modules/roleSelection";
import * as tourist from "./modules/tourist";

for (const ev of ["DISCORD_TOKEN"]) {
	if (process.env[ev] === undefined) {
		throw new Error(`Missing environment variable; please set ${ev}!`);
	}
}
const { DISCORD_TOKEN } = process.env;

const prisma = new PrismaClient();

const client = new Discord.Client({
	intents: [
		Discord.Intents.FLAGS.GUILDS,
		Discord.Intents.FLAGS.GUILD_MESSAGES,
	],
});

const buttonHandlers: MessageComponentInteractionHandler<Discord.ButtonInteraction> =
	{
		attendance: attendance.handleAttendanceButton,
		roleSelection: roleSelection.handleRoleSelectionButton,
		tourist: tourist.handleRoleSelectionButton,
	};

const menuHandlers: MessageComponentInteractionHandler<Discord.SelectMenuInteraction> =
	{
		roleSelection: roleSelection.handleRoleSelectionMenu,
	};

const startupChores = [
	{
		summary: "Schedule attendance polls",
		fn: async () =>
			await attendance.scheduleAttendancePolls(
				client,
				await prisma.attendancePoll.findMany({
					where: {
						type: "scheduled",
					},
				})
			),
		complete: "All attendance polls scheduled",
	},
	{
		summary: "Bootstrap roles",
		fn: async () => {
			if (
				(await prisma.config.findFirst({ where: { key: "rolesUp" } }))
					?.value === "yes"
			) {
				console.log("Was already up");
			} else {
				await prisma.config.upsert({
					where: { key: "rolesUp" },
					update: { value: "yes" },
					create: { key: "rolesUp", value: "yes" },
				});
				await prisma.roleGroup.create({
					data: {
						id: "degree",
						mode: "menu",
						placeholder: "Escolhe o teu curso",
						message:
							"Olá <@97446650548588544>!\n\n||(isto é uma mensagem)||",
						channelId: "859896451270574082",
						options: {
							create: [
								{
									label: "LEIC-A",
									description:
										"Licenciatura em Engenharia Informática e de Computadores - Alameda",
									value: "876961096253206542",
									emoji: "💻",
								},
								{
									label: "LEIC-T",
									description:
										"Licenciatura em Engenharia Informática e de Computadores - Taguspark",
									value: "876961212590587914",
									emoji: "🇹",
								},
								{
									label: "LEFT",
									description:
										"Licenciatura em Engenharia Física e Tecnológica",
									value: "876961271667372073",
									emoji: "⚛️",
								},
							],
						},
					},
				});
				await prisma.roleGroup.create({
					data: {
						id: "buttonstest",
						mode: "buttons",
						placeholder: "N/A",
						message: "Testing test",
						channelId: "859896451270574082",
						options: {
							create: [
								{
									label: "BTN1",
									description: "DANGER",
									value: "btn1",
									emoji: "📙",
								},
								{
									label: "Long button",
									description: "SECONDARY",
									value: "long",
								},
								{
									label: "i",
									description: "invalid",
									value: "small",
								},
							],
						},
					},
				});
			}
		},
		complete: "Added role groups to database",
	},
	{
		summary: "Test select menus",
		fn: async () => {
			await roleSelection.sendRoleSelectionMessages(client, prisma);
		},
		complete: "Testing select menus deployed",
	},
	{
		summary: "Send tourist message",
		fn: async () => {
			await tourist.sendTouristMessage(client, prisma);
		},
		complete: "Tourist message sent",
	},
];

client.on("ready", async () => {
	console.log(`Logged in as ${client.user?.tag}!`);

	console.log("Duty before self: starting chores...");

	for (const [i, chore] of startupChores.entries()) {
		const delta = await utils
			.timeFunction(chore.fn)
			.catch((e) => console.error("Chore error:", e));
		console.log(
			`[${i + 1}/${startupChores.length}] ${chore.complete} (${delta}ms)`
		);
	}
});

client.on("interactionCreate", async (interaction: Discord.Interaction) => {
	if (interaction.isMessageComponent()) {
		const msgCompInteraction =
			interaction as Discord.MessageComponentInteraction;
		const prefix = msgCompInteraction.customId.split(":")[0];

		// TODO: consider moving `await interaction.deferReply({ ephemeral: true });` here

		if (interaction.isButton()) {
			await buttonHandlers[prefix]?.(
				msgCompInteraction as Discord.ButtonInteraction,
				prisma
			);
		} else if (interaction.isSelectMenu()) {
			await menuHandlers[prefix]?.(
				msgCompInteraction as Discord.SelectMenuInteraction,
				prisma
			);
		}
	}
});

client.login(DISCORD_TOKEN);
