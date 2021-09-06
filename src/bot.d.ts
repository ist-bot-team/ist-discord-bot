// General types

import { PrismaClient } from "@prisma/client";
import * as Discord from "discord.js";
import { SlashCommandBuilder } from "@discordjs/builders";

export type InteractionHandler<T> = (
	interaction: T,
	prisma: PrismaClient,
	client: Discord.Client
) => Promise<void>;

export type InteractionHandlers<T> = {
	[prefix: string]: InteractionHandler<T>;
};

export interface CommandDescriptor {
	command: string;
	builder: SlashCommandBuilder;
	handler: InteractionHandler<Discord.CommandInteraction>;
}

export type CommandProvider = () => CommandDescriptor[];

export interface Chore {
	summary: string;
	fn: () => Promise<void>;
	complete: string;
}
