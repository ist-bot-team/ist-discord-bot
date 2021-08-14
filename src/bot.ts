import { ScheduledAttendancePoll } from "./modules/attendance.d";
import * as attendance from "./modules/attendance";
import * as Discord from "discord.js";
import * as storage from "./storage";

const client = new Discord.Client({
	intents: [
		Discord.Intents.FLAGS.GUILDS,
		Discord.Intents.FLAGS.GUILD_MESSAGES,
	],
});

const buttonHandlers: Record<
	string,
	(interaction: Discord.ButtonInteraction) => Promise<void>
> = {
	attendance: attendance.handleAttendanceButton,
};

client.on("ready", async () => {
	await attendance.scheduleAttendancePolls(
		client,
		storage
			.getAttendancePolls()
			.filter((poll) => poll.type === "scheduled")
			.map((poll) => poll as ScheduledAttendancePoll)
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

const loadBot = async (): Promise<void> => {
	await storage.loadStorage();

	client.login(process.env.DISCORD_TOKEN);
};

if (process.env.DISCORD_TOKEN) {
	loadBot();
} else {
	console.error(
		"Discord token not set. Please set the DISCORD_TOKEN environment variable"
	);
}
