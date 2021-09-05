// Main controller

import Discord from "discord.js";
import { SlashCommandBuilder } from "@discordjs/builders";
import {
	RESTPostAPIApplicationCommandsJSONBody,
	Routes,
} from "discord-api-types/v9";
import { REST } from "@discordjs/rest";
import { PrismaClient } from "@prisma/client";

import { InteractionHandlers, Chore } from "./bot.d";

import * as utils from "./modules/utils";
import * as attendance from "./modules/attendance";
import * as roleSelection from "./modules/roleSelection";
import * as populate from "./modules/populate";

for (const ev of ["DISCORD_TOKEN", "GUILD_ID"]) {
	if (process.env[ev] === undefined) {
		throw new Error(`Missing environment variable; please set ${ev}!`);
	}
}
const { DISCORD_TOKEN, GUILD_ID } = process.env;

const prisma = new PrismaClient();

const client = new Discord.Client({
	intents: [
		Discord.Intents.FLAGS.GUILDS,
		Discord.Intents.FLAGS.GUILD_MESSAGES,
	],
});

const commandProviders: (() => SlashCommandBuilder[])[] = [
	roleSelection.provideCommands,
];

const commandHandlers: InteractionHandlers<Discord.CommandInteraction> = {
	"role-selection": roleSelection.handleCommand,
};

const buttonHandlers: InteractionHandlers<Discord.ButtonInteraction> = {
	attendance: attendance.handleAttendanceButton,
	roleSelection: roleSelection.handleRoleSelectionButton,
};

const menuHandlers: InteractionHandlers<Discord.SelectMenuInteraction> = {
	roleSelection: roleSelection.handleRoleSelectionMenu,
};

const startupChores: Chore[] = [
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
		summary: "Populate database with mock/default/test data",
		fn: async () => {
			await populate.populateDatabase(prisma);
		},
		complete: "Database fully populated with mock/default/test data",
	},
	{
		summary: "Send role selection messages",
		fn: async () => {
			await roleSelection.sendRoleSelectionMessages(client, prisma);
		},
		complete: "Role selection messages deployed",
	},
	{
		summary: "Register slash commands",
		fn: async () => {
			const commands: RESTPostAPIApplicationCommandsJSONBody[] = [];
			for (const provider of commandProviders) {
				for (const builder of provider()) {
					commands.push(builder.toJSON());
				}
			}

			const rest = new REST({ version: "9" }).setToken(
				DISCORD_TOKEN as string
			);

			// TODO: use built-in slash commands permissions

			const useGlobalCommands =
				GUILD_ID?.toLocaleLowerCase() === "global";
			await rest.put(
				Routes.applicationCommands(client?.user?.id as string),
				{ body: useGlobalCommands ? commands : [] }
			);
			if (!useGlobalCommands) {
				await rest.put(
					Routes.applicationGuildCommands(
						client?.user?.id as string,
						GUILD_ID as string
					),
					{ body: commands }
				);
			}
		},
		complete: "All slash commands registered",
	},
];

client.on("ready", async () => {
	console.log(`Logged in as ${client.user?.tag}!`);

	console.log("Duty before self: starting chores...");

	for (const [i, chore] of startupChores.entries()) {
		const delta = await utils
			.timeFunction(chore.fn)
			.catch((e) => console.error("Chore error:", chore.summary, "-", e));
		console.log(
			`[${i + 1}/${startupChores.length}] ${chore.complete} (${delta}ms)`
		);
	}

	console.log("Ready!");
});

client.on("interactionCreate", async (interaction: Discord.Interaction) => {
	try {
		if (interaction.isMessageComponent()) {
			const prefix = interaction.customId.split(":")[0];

			// TODO: consider moving `await interaction.deferReply({ ephemeral: true });` here

			if (interaction.isButton()) {
				await buttonHandlers[prefix]?.(
					interaction as Discord.ButtonInteraction,
					prisma
				);
			} else if (interaction.isSelectMenu()) {
				await menuHandlers[prefix]?.(
					interaction as Discord.SelectMenuInteraction,
					prisma
				);
			}
		} else if (interaction.isCommand()) {
			await interaction.deferReply({ ephemeral: true });

			// TODO: permissions!!

			await commandHandlers[interaction.commandName]?.(
				interaction,
				prisma
			);
		}
	} catch (e) {
		console.error("Problem handling interaction: " + e.message);
	}
});

client.login(DISCORD_TOKEN);
