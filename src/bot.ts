import { ScheduledAttendancePoll } from "./modules/attendance.d";
import * as attendance from "./modules/attendance";
import * as Discord from "discord.js";
import Storage from "./storage";

for (const ev of ["DISCORD_TOKEN", "DB_PATH"]) {
	if (process.env[ev] === undefined) {
		throw new Error(`Missing environment variable; please set ${ev}!`);
	}
}
const { DISCORD_TOKEN, DB_PATH } = process.env;

const storage = new Storage(DB_PATH as string);
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

client.on("ready", async () => {
	await attendance.scheduleAttendancePolls(
		client,
		attendanceUnit
			.select("*", { type: "scheduled" })
			.all()
			.map((p) => p as ScheduledAttendancePoll)
	);

	console.log(`Logged in as ${client.user?.tag}!`);
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
