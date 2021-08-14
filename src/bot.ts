import { Client, Intents, TextChannel } from "discord.js";

const { DISCORD_TOKEN } = process.env;

const client = new Client({
	intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
});

let maintenanceStatus: { enabled: boolean; reason?: string };
const maintenanceCommands = {};

client.once("ready", () => {
	console.log("Ready!");

	maintenanceStatus = { enabled: true, reason: "i said so" }; //updateMaintenanceStatus();

	if (maintenanceStatus.enabled) {
		client.user?.setPresence({
			status: "idle",
			activities: [{ name: "🔧 Maintenance Mode" }],
		});
		for (const [_id, guild] of client.guilds.cache) {
			const channel =
				guild.systemChannel ??
				(guild.channels.cache
					.filter((c) => c.isText())
					.first() as TextChannel);
			channel?.send(
				`Activating **MAINTENANCE MODE** because \`${
					maintenanceStatus.reason
				}\`.
				- Slash commands are not available;
				- Prefix is \`#\`;
				- Bot owners and users with a role called (exactly) \`Admin\` may interact;
				- Commands: ${Object.keys(maintenanceCommands)
					.map((k) => "`" + k + "`")
					.join(", ")}`
			);
		}
	}
});

client.login(DISCORD_TOKEN);
