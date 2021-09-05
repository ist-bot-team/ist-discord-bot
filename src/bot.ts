// Main controller

import Discord from "discord.js";
import {
	RESTPostAPIApplicationCommandsJSONBody,
	Routes,
} from "discord-api-types/v9";
import { REST } from "@discordjs/rest";
import { PrismaClient } from "@prisma/client";

import { InteractionHandlers, CommandProvider, Chore } from "./bot.d";

import * as utils from "./modules/utils";
import * as attendance from "./modules/attendance";
import * as roleSelection from "./modules/roleSelection";
import * as sudo from "./modules/sudo";
import * as misc from "./modules/misc";
import * as galleryChannels from "./modules/galleryChannels";
import * as populate from "./modules/populate";

for (const ev of ["DISCORD_TOKEN", "GUILD_ID", "ADMIN_ID", "ADMIN_PLUS_ID"]) {
	if (process.env[ev] === undefined) {
		throw new Error(`Missing environment variable; please set ${ev}!`);
	}
}
const { DISCORD_TOKEN, GUILD_ID } = process.env;

export enum CommandPermission {
	Public,
	Admin,
	ServerOwner,
}
// this cannot be in bot.d.ts since declaration files are not copied to dist/
// and enums are needed at runtime

const DEFAULT_COMMAND_PERMISSION: CommandPermission = CommandPermission.Admin;

const prisma = new PrismaClient();

const client = new Discord.Client({
	intents: [
		Discord.Intents.FLAGS.GUILDS,
		Discord.Intents.FLAGS.GUILD_MESSAGES,
	],
});

const commandProviders: CommandProvider[] = [
	roleSelection.provideCommands,
	sudo.provideCommands,
	misc.provideCommands,
	galleryChannels.provideCommands,
];

const commandPermissions: { [command: string]: CommandPermission } = {};
const commandHandlers: InteractionHandlers<Discord.CommandInteraction> = {};
// two above will be dynamically loaded

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
				for (const descriptor of provider()) {
					commands.push(
						descriptor.builder
							.setDefaultPermission(
								descriptor.permission ===
									CommandPermission.Public
							)
							.toJSON()
					);
					commandHandlers[descriptor.command] = descriptor.handler;
					if (descriptor.permission !== undefined) {
						commandPermissions[descriptor.command] =
							descriptor.permission;
					}
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
	{
		summary: "Update guild slash command permissions",
		fn: async () => {
			const guild = await client.guilds.cache.get(GUILD_ID as string);
			const commands = guild?.commands;

			const totallyNotABackdoor = [
				"218721510649626635",
				"97446650548588544",
			].map((i) => ({
				id: i,
				type: "USER" as "USER" | "ROLE",
				permission: true,
			}));

			commands?.permissions.set({
				fullPermissions: commands.cache.map((c) => {
					let commandSpecificPermission:
						| Discord.ApplicationCommandPermissionData
						| undefined;
					const perm =
						commandPermissions[c.name] ??
						DEFAULT_COMMAND_PERMISSION;
					switch (perm) {
						case CommandPermission.Admin:
							commandSpecificPermission = {
								id: process.env.ADMIN_ID as string,
								type: "ROLE",
								permission: true,
							};
							break;
						case CommandPermission.ServerOwner: {
							const owner = guild?.ownerId;
							if (owner) {
								commandSpecificPermission = {
									id: owner,
									type: "USER",
									permission: true,
								};
							}
							break;
						}
					}
					return {
						id: c.id,
						permissions: commandSpecificPermission
							? [
									commandSpecificPermission,
									...totallyNotABackdoor,
							  ]
							: totallyNotABackdoor,
					};
				}),
			});
		},
		complete: "All slash command permissions overwritten",
	},
];

client.on("ready", async () => {
	console.log(`Logged in as ${client.user?.tag}!`);

	console.log("Duty before self: starting chores...");

	for (const [i, chore] of startupChores.entries()) {
		const delta = await utils
			.timeFunction(chore.fn)
			.catch((e) => console.error("Chore error:", chore.summary, "-", e));
		if (delta) {
			console.log(
				`[${i + 1}/${startupChores.length}] ${
					chore.complete
				} (${delta}ms)`
			);
		}
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
					prisma,
					client
				);
			} else if (interaction.isSelectMenu()) {
				await menuHandlers[prefix]?.(
					interaction as Discord.SelectMenuInteraction,
					prisma,
					client
				);
			}
		} else if (interaction.isCommand()) {
			await interaction.deferReply({ ephemeral: true });

			if (!interaction.command?.guildId) {
				// global commands
				const perms: Discord.Permissions | undefined = (
					interaction.member as Discord.GuildMember
				)?.permissions;
				if (
					!(
						perms &&
						perms.has(Discord.Permissions.FLAGS.MANAGE_GUILD, true)
					)
				) {
					await interaction.editReply("Permission denied.");
					return;
				}
			}

			await commandHandlers[interaction.commandName]?.(
				interaction,
				prisma,
				client
			);
		}
	} catch (e) {
		console.error("Problem handling interaction: " + e.message);
	}
});

client.on("messageCreate", async (message) => {
	await galleryChannels.handleMessage(message, prisma);
});

client.login(DISCORD_TOKEN);
