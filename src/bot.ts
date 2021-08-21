// Main controller

import Discord from "discord.js";
import { PrismaClient } from "@prisma/client";

import { MessageComponentInteractionHandler } from "./bot.d";

import * as utils from "./modules/utils";
import * as attendance from "./modules/attendance";
import * as roleSelection from "./modules/roleSelection";

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
			if (await prisma.config.findFirst({ where: { key: "rolesUp" } })) {
				console.log("Was already up");
			} else {
				prisma.roleGroup.create({
					data: {
						id: "degree",
						mode: "menu",
						placeholder: "Escolhe o teu curso",
						options: {
							create: [
								{
									label: "LEIC-A",
									description:
										"Licenciatura em Engenharia Informática e de Computadores - Alameda",
									value: "876961096253206542",
								},
								{
									label: "LEIC-T",
									description:
										"Licenciatura em Engenharia Informática e de Computadores - Taguspark",
									value: "876961212590587914",
								},
								{
									label: "LEFT",
									description:
										"Licenciatura em Engenharia Física e Tecnológica",
									value: "876961271667372073",
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
			const channel = client.channels.cache.find(
				(c) => c.id === "859896451270574082"
			);
			if (channel) {
				await roleSelection.sendRoleSelectionMessages(
					channel as Discord.TextChannel,
					prisma
				);
			}
		},
		complete: "Testing select menus deployed",
	},
];

client.on("ready", async () => {
	console.log(`Logged in as ${client.user?.tag}!`);

	console.log("Duty before self: starting chores...");

	for (const [i, chore] of startupChores.entries()) {
		const delta = await utils.timeFunction(chore.fn);
		console.log(
			`[${i + 1}/${startupChores.length}] ${chore.complete} (${delta}ms)`
		);
	}
});

client.on("interactionCreate", async (interaction: Discord.Interaction) => {
	if (interaction.isMessageComponent()) {
		const msgCompInteraction =
			interaction as Discord.MessageComponentInteraction;
		const [prefix, _arg] = utils.getCustomIdComponents(
			msgCompInteraction.customId
		);

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
