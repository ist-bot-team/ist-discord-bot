// Main controller

import Discord, {
	ChannelType,
	Client,
	CommandInteraction,
	GatewayIntentBits,
	RESTPostAPIApplicationCommandsJSONBody,
	Routes,
} from "discord.js";
import { REST } from "@discordjs/rest";
import { PrismaClient } from "@prisma/client";

import {
	InteractionHandlers,
	CommandProvider,
	Chore,
	InteractionHandler,
} from "./bot.d";

import * as utils from "./modules/utils";
import * as polls from "./modules/polls";
import * as roleSelection from "./modules/roleSelection";
import * as sudo from "./modules/sudo";
import * as misc from "./modules/misc";
import * as galleryChannels from "./modules/galleryChannels";
import * as welcome from "./modules/welcome";
import * as leaderboard from "./modules/leaderboard";
import * as degrees from "./modules/degrees";
import * as courses from "./modules/courses";
import * as rss from "./modules/rss";

import logger from "./logger";

for (const ev of [
	"DISCORD_TOKEN",
	"GUILD_ID",
	"ADMIN_ID",
	"ADMIN_PLUS_ID",
	"COMMAND_LOGS_CHANNEL_ID",
]) {
	if (process.env[ev] === undefined) {
		throw new Error(`Missing environment variable; please set ${ev}!`);
	}
}
const { DISCORD_TOKEN, GUILD_ID, COMMAND_LOGS_CHANNEL_ID } = process.env;

// this cannot be in bot.d.ts since declaration files are not copied to dist/
// and enums are needed at runtime
export enum CommandPermission {
	Public,
	Admin,
}

const prisma = new PrismaClient();

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMembers, // THIS IS A PRIVILEGED INTENT! MANUAL ACTION REQUIRED TO ENABLE!
	],
});

const commandProviders: CommandProvider[] = [
	polls.provideCommands,
	roleSelection.provideCommands,
	sudo.provideCommands,
	misc.provideCommands,
	galleryChannels.provideCommands,
	welcome.provideCommands,
	leaderboard.provideCommands,
	degrees.provideCommands,
	courses.provideCommands,
];

const commandPermissions: { [command: string]: CommandPermission } = {};
const commandHandlers: InteractionHandlers<CommandInteraction> = {};
// two above will be dynamically loaded

const buttonHandlers: InteractionHandlers<Discord.ButtonInteraction> = {
	polls: polls.handlePollButton,
	roleSelection: roleSelection.handleRoleSelectionButton,
};

const menuHandlers: InteractionHandlers<Discord.SelectMenuInteraction> = {
	roleSelection: roleSelection.handleRoleSelectionMenu,
};

let commandLogsChannel: Discord.TextBasedChannel | undefined;

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
		summary: "Register application commands",
		fn: async () => {
			const commands: RESTPostAPIApplicationCommandsJSONBody[] = [];
			for (const provider of commandProviders) {
				for (const descriptor of provider()) {
					const name = descriptor.builder.name;
					commands.push(
						descriptor.builder
							// bot should only be used on the server
							.setDMPermission(false)
							// undefined leaves the default (everyone), 0 restricts to admins
							.setDefaultMemberPermissions(
								descriptor.permission ===
									CommandPermission.Public
									? undefined
									: 0
							)
							.toJSON()
					);
					commandHandlers[name] =
						descriptor.handler as InteractionHandler<CommandInteraction>;
					if (descriptor.permission !== undefined) {
						commandPermissions[name] = descriptor.permission;
					}
				}
			}

			const rest = new REST({ version: "10" }).setToken(
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
		complete: "All application commands registered",
	},
	/* This does not work with new Discord API
	{
		summary: "Update guild slash command permissions",
		fn: async () => {
			const guild = await client.guilds.cache.get(GUILD_ID as string);
			const commands = guild?.commands;

			const fetched = await commands?.fetch();

			if (!fetched) {
				throw new Error("Failed to fetch commands from guild.");
			}

			await Promise.all(
				fetched.map(async (c) => {
					let commandSpecificPermission:
						| Discord.ApplicationCommandPermissions
						| undefined;
					const perm =
						commandPermissions[c.name] ??
						DEFAULT_COMMAND_PERMISSION;
					switch (perm) {
						case CommandPermission.Admin:
							commandSpecificPermission = {
								id: process.env.ADMIN_ID as string,
								type: ApplicationCommandPermissionType.Role,
								permission: true,
							};
							break;
						case CommandPermission.ServerOwner: {
							const owner = guild?.ownerId;
							if (owner) {
								commandSpecificPermission = {
									id: owner,
									type: ApplicationCommandPermissionType.User,
									permission: true,
								};
							}
							break;
						}
					}

					if (commandSpecificPermission) {
						await commands?.permissions.set({
							token: client.token as string,
							command: c.id,
							permissions: [commandSpecificPermission],
						});
					}
				})
			);
		},
		complete: "All slash command permissions overwritten",
	},*/
	{
		summary: "Start RSS cron job",
		fn: async () => {
			rss.scheduleRSSFeedJob(prisma, client);
		},
		complete: "Finished starting RSS cron job",
	},
	{
		summary: "Find command logging channel",
		fn: async () => {
			try {
				const c = await client.channels.fetch(
					COMMAND_LOGS_CHANNEL_ID ?? ""
				);
				if (c?.type !== ChannelType.GuildText) {
					throw new Error("Wrong type");
				} else {
					commandLogsChannel =
						(await c.fetch()) as typeof commandLogsChannel;
				}
			} catch (e) {
				throw new Error("Failed to find channel");
			}
		},
		complete: "Successfully set command logging channel",
	},
];

client.on("ready", async () => {
	logger.info(`Logged in as ${client.user?.tag}!`);

	logger.info("Duty before self: starting chores...");

	for (const [i, chore] of startupChores.entries()) {
		const delta = await utils
			.timeFunction(chore.fn)
			.catch((e) =>
				logger.error(
					e,
					"An error occurred while executing chore '%s'",
					chore.summary
				)
			);
		if (delta) {
			logger.info(
				`[${i + 1}/${startupChores.length}] ${
					chore.complete
				} (${delta}ms)`
			);
		}
	}

	logger.info("Ready!");
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
		} else if (
			interaction.isChatInputCommand() ||
			interaction.isContextMenuCommand()
		) {
			await interaction.deferReply({ ephemeral: true });

			if (
				!interaction.command?.guildId &&
				interaction.guildId !== GUILD_ID
			) {
				// global commands
				const perms: Discord.PermissionsBitField | undefined = (
					interaction.member as Discord.GuildMember
				)?.permissions;
				if (
					!(
						perms &&
						perms.has(Discord.PermissionFlagsBits.ManageGuild, true)
					)
				) {
					await interaction.editReply("Permission denied.");
					return;
				}
			}

			try {
				const str = utils.stringifyCommand(interaction);
				logger.debug({ interaction }, "Handling command %s", str);
				await commandLogsChannel?.send({
					content: str,
					allowedMentions: { parse: [] },
				});
			} catch (e) {
				// do nothing
			}
			// TODO: show a X or CheckMark emoji before `str` to indicate whether
			// TODO: the command was successful; that ruins the simplicity of the
			// TODO: statement below vvvv, though :(

			await commandHandlers[interaction.commandName]?.(
				interaction,
				prisma
			);
		}
	} catch (e) {
		logger.error(e, "An error occurred while handling an interaction");
	}
});

client.on("messageCreate", async (message) => {
	await galleryChannels.handleMessage(message, prisma);
});

client.on("guildMemberAdd", async (member) => {
	await welcome.handleGuildJoin(member, prisma);
});

client.login(DISCORD_TOKEN);
