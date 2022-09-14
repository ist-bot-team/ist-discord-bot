// General types

import { PrismaClient } from "@prisma/client";
import * as Discord from "discord.js";
import { SlashCommandBuilder } from "@discordjs/builders";

export type InteractionHandler<T> = (
	interaction: T,
	prisma: PrismaClient
) => Promise<void>;

export type InteractionHandlers<T> = {
	[prefix: string]: InteractionHandler<T>;
};

export interface CommandDescriptor {
	builder: SlashCommandBuilder;
	handler: InteractionHandler<Discord.ChatInputCommandInteraction>;
	permission?: CommandPermission;
}

export type CommandProvider = () => CommandDescriptor[];

export interface Chore {
	summary: string;
	fn: () => Promise<void>;
	complete: string;
}
