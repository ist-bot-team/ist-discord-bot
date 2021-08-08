import { Client, Intents } from "discord.js";

const { DISCORD_TOKEN } = process.env;

const client = new Client({
	intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
});

client.once("ready", () => {
	console.log("Ready!");
});

client.login(DISCORD_TOKEN);
