// General types

import { PrismaClient } from "@prisma/client";
import * as Discord from "discord.js";

export type InteractionHandlers<T> = {
	[prefix: string]: (
		interaction: T,
		prisma: PrismaClient,
		client: Discord.Client
	) => Promise<void>;
};

export interface Chore {
	summary: string;
	fn: () => Promise<void>;
	complete: string;
}
