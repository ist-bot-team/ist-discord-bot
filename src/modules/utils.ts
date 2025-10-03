// Misc. utilities

import { performance } from "perf_hooks";

import { PrismaClient } from "@prisma/client";
import * as Discord from "discord.js";

import { MessageCollection } from "./utils.d";
import { ApplicationCommandOptionType } from "discord.js";

import logger from "../logger";

export const XEmoji = "❌ ";
export const CheckMarkEmoji = "✅ ";

export async function timeFunction(
	fun: () => Promise<unknown>,
): Promise<number | [number, unknown]> {
	const t0 = performance.now();
	const res = await fun();
	const t1 = performance.now();
	const delta = Math.round((t1 - t0 + Number.EPSILON) * 100) / 100;
	if (res === undefined) {
		return delta;
	} else {
		return [delta, res];
	}
}

export function getConfigFactory(
	prisma: PrismaClient,
	scope: string,
): (key: string, throwIfMissing?: boolean) => Promise<string | undefined> {
	return async (key: string, throwIfMissing?: boolean) => {
		const result = (
			await prisma.config.findFirst({ where: { key: `${scope}:${key}` } })
		)?.value;
		if (throwIfMissing && result === undefined) {
			throw new Error(`Missing config "${scope}:${key}"`);
		}
		return result;
	};
}

export function divmod(a: number, b: number): [number, number] {
	return [Math.floor(a / b), a % b];
}

export function durationString(time: number): string {
	time = Math.round(time / 1000); // ms -> secs
	let tmp;
	const strs: string[] = [],
		seps: { [label: string]: number } = {
			day: 24 * 60 * 60,
			hour: 60 * 60,
			min: 60,
			sec: 1,
		};
	for (const [label, secs] of Object.entries(seps)) {
		[tmp, time] = divmod(time, secs);
		if (tmp) {
			strs.push(tmp + " " + label + (tmp === 1 ? "" : "s"));
		}
	}
	return strs.join(", ");
}

export async function fetchGalleries(
	prisma: PrismaClient,
): Promise<Discord.Snowflake[]> {
	return (
		(await prisma.config.findFirst({ where: { key: "gallery_channels" } }))
			?.value ?? ""
	)
		.split(",")
		.filter((c) => c.length);
}

export async function fetchAllChannelMessages(
	channel: Discord.TextChannel | Discord.ThreadChannel,
	after?: Date,
): Promise<MessageCollection> {
	const messages = new Discord.Collection<string, Discord.Message>();
	let fetched: MessageCollection | undefined;

	do {
		fetched = await channel.messages.fetch({
			limit: 100,
			before: fetched ? fetched.last()?.id : undefined,
		});
		fetched.map((msg, id) => messages.set(id, msg));
	} while (
		fetched.size >= 100 &&
		(fetched.last()?.createdAt ?? 1) > (after ?? 0)
	);

	return messages;
}

export function removeDuplicatesFromArray<T>(
	array: T[],
	getKey?: (item: T) => unknown,
): T[] {
	if (!getKey) getKey = (v) => v;

	return array.filter(
		(value, i) =>
			!array.some((v, j) => j < i && getKey?.(value) === getKey?.(v)),
	);
}

export function generateHexCode(): string {
	let randomHexCode = "#";
	while (randomHexCode.length < 7) {
		randomHexCode += Math.floor(Math.random() * 15).toString(16);
	}
	return randomHexCode;
}

function stringifyChatInputCommand(
	interaction: Discord.ChatInputCommandInteraction,
): string {
	const subcommandGroup = interaction.options.getSubcommandGroup(false);
	const subcommand = interaction.options.getSubcommand(false);

	const options: string[] = [];

	const extractOptions = (
		opt: readonly Discord.CommandInteractionOption[] | undefined,
	): readonly Discord.CommandInteractionOption[] =>
		opt === undefined
			? []
			: opt.length === 1 &&
				  [
						ApplicationCommandOptionType.Subcommand,
						ApplicationCommandOptionType.SubcommandGroup,
				  ].includes(opt[0].type)
				? extractOptions(opt[0].options)
				: opt;

	for (const opt of extractOptions(interaction.options.data)) {
		const specialValue = opt.channel ?? opt.member ?? opt.user ?? opt.role;
		options.push(
			`${opt.name}: ${opt.value?.toString()}` +
				(specialValue ? ` (${specialValue})` : ""),
		);
	}

	return (
		`[${interaction.user.tag}]: /` +
		interaction.commandName +
		(subcommandGroup ? " " + subcommandGroup : "") +
		(subcommand ? " " + subcommand : "") +
		(options.length ? ["", ...options].join("\n-\t") : "")
	);
}

function stringifyContextMenuCommand(
	interaction: Discord.ContextMenuCommandInteraction,
): string {
	let target;
	if (interaction.isUserContextMenuCommand()) {
		target = `${interaction.targetUser}`;
	} else if (interaction.isMessageContextMenuCommand()) {
		target = `https://discord.com/channels/${
			interaction.guildId ?? "@me"
		}/${interaction.channelId}/${interaction.targetId}`;
	}

	return `[${interaction.user.tag}]: \`${interaction.commandName}\` @ ${target}`;
}

export function stringifyCommand(
	interaction: Discord.CommandInteraction,
): string {
	if (interaction.isChatInputCommand()) {
		return stringifyChatInputCommand(interaction);
	} else if (interaction.isContextMenuCommand()) {
		return stringifyContextMenuCommand(interaction);
	} else {
		logger.error(
			{ interaction },
			"Failed to stringify command due to unknown type",
		);
		throw new Error("Unknown command type");
	}
}
