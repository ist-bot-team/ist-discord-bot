import { performance } from "perf_hooks";
import Discord from "discord.js";
import Storage, { KVStorageUnit } from "./storage";

import * as attendance from "./modules/attendance";
import { ScheduledAttendancePoll } from "./modules/attendance.d";

for (const ev of ["DISCORD_TOKEN", "DB_PATH"]) {
	if (process.env[ev] === undefined) {
		throw new Error(`Missing environment variable; please set ${ev}!`);
	}
}
const { DISCORD_TOKEN, DB_PATH } = process.env;

const storage = new Storage(DB_PATH as string);
const configUnit = storage.getUnit("config", {
	key: "TEXT PRIMARY_KEY",
	value: "TEXT",
}) as KVStorageUnit;
const attendanceUnit = storage.getUnit("attendancePolls", {
	id: "TEXT PRIMARY_KEY",
	type: "TEXT",
	title: "TEXT",
	cron: "TEXT",
	channelId: "TEXT",
});

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
				attendanceUnit
					.select("*", { type: "scheduled" })
					.all()
					.map((p) => p as ScheduledAttendancePoll)
			)
	);
	console.log(`All attendance polls scheduled (delta=${delta}ms)`);

	console.log("Before setting:", configUnit.getValue("dummy"));

	configUnit.setValue("dummy", 7);

	console.log("After setting:", configUnit.getValue("dummy"));
});

client.on("interactionCreate", async (interaction: Discord.Interaction) => {
	if (interaction.isButton()) {
		const msgCompInteraction = interaction as Discord.ButtonInteraction;
		const prefix = msgCompInteraction.customId.split(":")[0];

		await buttonHandlers[prefix]?.(msgCompInteraction);
	}
});

const loadBot = async () => {
	client.login(DISCORD_TOKEN);
};

if (DISCORD_TOKEN) {
	loadBot();
} else {
	console.error(
		"Discord token not set. Please set the DISCORD_TOKEN environment variable"
	);
}
