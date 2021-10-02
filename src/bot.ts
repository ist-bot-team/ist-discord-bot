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
import * as polls from "./modules/polls";
import * as roleSelection from "./modules/roleSelection";
import * as sudo from "./modules/sudo";
import * as misc from "./modules/misc";
import * as galleryChannels from "./modules/galleryChannels";
import * as voiceThreads from "./modules/voiceThreads";
import * as welcome from "./modules/welcome";
import * as leaderboard from "./modules/leaderboard";
import * as degrees from "./modules/degrees";
import * as courses from "./modules/courses";
import * as rss from "./modules/rss";
import { getDegreeCourses } from "./modules/fenix";

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
		Discord.Intents.FLAGS.GUILD_VOICE_STATES,
		Discord.Intents.FLAGS.GUILD_MEMBERS, // THIS IS A PRIVILEGED INTENT! MANUAL ACTION REQUIRED TO ENABLE!
	],
});

const commandProviders: CommandProvider[] = [
	polls.provideCommands,
	roleSelection.provideCommands,
	sudo.provideCommands,
	misc.provideCommands,
	galleryChannels.provideCommands,
	voiceThreads.provideCommands,
	welcome.provideCommands,
	leaderboard.provideCommands,
	degrees.provideCommands,
	courses.provideCommands,
];

const commandPermissions: { [command: string]: CommandPermission } = {};
const commandHandlers: InteractionHandlers<Discord.CommandInteraction> = {};
// two above will be dynamically loaded

const buttonHandlers: InteractionHandlers<Discord.ButtonInteraction> = {
	polls: polls.handlePollButton,
	roleSelection: roleSelection.handleRoleSelectionButton,
};

const menuHandlers: InteractionHandlers<Discord.SelectMenuInteraction> = {
	roleSelection: roleSelection.handleRoleSelectionMenu,
};

const startupChores: Chore[] = [
	{
		summary: "Schedule polls",
		fn: async () => {
			await polls.scheduleAllScheduledPolls(client, prisma);
		},
		complete: "All polls scheduled",
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
					const name = descriptor.builder.name;
					commands.push(
						descriptor.builder
							.setDefaultPermission(
								descriptor.permission ===
									CommandPermission.Public
							)
							.toJSON()
					);
					commandHandlers[name] = descriptor.handler;
					if (descriptor.permission !== undefined) {
						commandPermissions[name] = descriptor.permission;
					}
				}
			}

			const rest = new REST({ version: "9" }).setToken(
				DISCORD_TOKEN as string
			);

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

			const fetched = await commands?.fetch();

			if (fetched) {
				await commands?.permissions.set({
					fullPermissions: fetched.map((c) => {
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
								? [commandSpecificPermission]
								: [],
						};
					}),
				});
			}
		},
		complete: "All slash command permissions overwritten",
	},
	{
		summary: "Test fenix api",
		fn: async () => {
			getDegreeCourses("2761663971474", "2020/2021");
		},
		complete: "Finished testing fenix api",
	},
	{
		summary: "Start RSS cron job",
		fn: async () => {
			rss.scheduleRSSFeedJob(prisma, client);
		},
		complete: "Finished starting RSS cron job",
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
				prisma
			);
		}
	} catch (e) {
		console.error("Problem handling interaction: " + (e as Error).message);
	}
});

client.on("messageCreate", async (message) => {
	await galleryChannels.handleMessage(message, prisma);
});

client.on("voiceStateUpdate", async (oldState, newState) => {
	if (oldState.channelId === newState.channelId) {
		return;
	}
	if (oldState.channelId !== null) {
		try {
			await voiceThreads.handleVoiceLeave(oldState, prisma);
		} catch (e) {
			console.error(
				"Someone left a VC, GONE WRONG!!!:",
				(e as Error).message
			);
		}
	}

	if (newState.channelId !== null) {
		try {
			await voiceThreads.handleVoiceJoin(newState, prisma);
		} catch (e) {
			console.error(
				"Someone joined a VC, GONE WRONG!!!:",
				(e as Error).message
			);
		}
	}
});

client.on("guildMemberAdd", async (member) => {
	await welcome.handleGuildJoin(member, prisma);
});

client.login(DISCORD_TOKEN);
