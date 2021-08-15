import { performance } from "perf_hooks";
import Discord from "discord.js";
import { PrismaClient } from "@prisma/client";

import * as attendance from "./modules/attendance";

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

const buttonHandlers: {
	[prefix: string]: (interaction: Discord.ButtonInteraction) => Promise<void>;
} = {
	attendance: attendance.handleAttendanceButton,
};

// TODO: move this somewhere else
const timeFunction = async (fun: () => Promise<void>) => {
	const t0 = performance.now();
	await fun();
	const t1 = performance.now();
	return Math.round((t1 - t0 + Number.EPSILON) * 100) / 100;
};

client.on("ready", async () => {
	console.log(`Logged in as ${client.user?.tag}!`);

	const delta = await timeFunction(
		async () =>
			await attendance.scheduleAttendancePolls(
				client,
				await prisma.attendancePoll.findMany({
					where: {
						type: "scheduled",
					},
				})
			)
	);
	console.log(`All attendance polls scheduled (delta=${delta}ms)`);

	console.log(
		"Before setting:",
		(
			await prisma.config.findUnique({
				where: {
					key: "dummy",
				},
			})
		)?.value
	);

	await prisma.config.upsert({
		where: {
			key: "dummy",
		},
		update: {
			value: "7",
		},
		create: {
			key: "dummy",
			value: "6",
		},
	});

	console.log(
		"After setting:",
		(
			await prisma.config.findUnique({
				where: {
					key: "dummy",
				},
			})
		)?.value
	);
});

client.on("interactionCreate", async (interaction: Discord.Interaction) => {
	if (interaction.isButton()) {
		const msgCompInteraction = interaction as Discord.ButtonInteraction;
		const prefix = msgCompInteraction.customId.split(":")[0];

		await buttonHandlers[prefix]?.(msgCompInteraction);
	}
});

client.login(DISCORD_TOKEN);
