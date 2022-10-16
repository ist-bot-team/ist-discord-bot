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

export type InteractionHandlers<T extends Discord.BaseInteraction> = {
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
	| GenericCommandDescriptor<
			ContextMenuCommandBuilder, // there isn't a `MessageContextMenuCommandBuilder`
			Discord.MessageContextMenuCommandInteraction
	  >
	| GenericCommandDescriptor<
			ContextMenuCommandBuilder, // there isn't a `UserContextMenuCommandBuilder`
			Discord.UserContextMenuCommandInteraction
	  >;

export type CommandProvider = () => CommandDescriptor[];

export interface Chore {
	summary: string;
	fn: () => Promise<void>;
	complete: string;
}
