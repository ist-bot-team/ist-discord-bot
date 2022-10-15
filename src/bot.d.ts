// General types

import { PrismaClient } from "@prisma/client";
import * as Discord from "discord.js";
import {
	SlashCommandBuilder,
	ContextMenuCommandBuilder,
} from "@discordjs/builders";

export type InteractionHandler<T extends Discord.BaseInteraction> = (
	interaction: T,
	prisma: PrismaClient
) => Promise<void>;

export type InteractionHandlers<T> = {
	[prefix: string]: InteractionHandler<T>;
};

export type ApplicationCommandBuilder =
	| SlashCommandBuilder
	| ContextMenuCommandBuilder;

interface GenericCommandDescriptor<
	B extends ApplicationCommandBuilder,
	I extends Discord.CommandInteraction
> {
	builder: B;
	handler: InteractionHandler<I>;
	permission?: CommandPermission;
}

export type CommandDescriptor =
	| GenericCommandDescriptor<
			SlashCommandBuilder,
			Discord.ChatInputCommandInteraction
	  >
	// TODO: possibly split into Message and User here
	| GenericCommandDescriptor<
			ContextMenuCommandBuilder,
			Discord.ContextMenuCommandInteraction
	  >;

export type CommandProvider = () => CommandDescriptor[];

export interface Chore {
	summary: string;
	fn: () => Promise<void>;
	complete: string;
}
