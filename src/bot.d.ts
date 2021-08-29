// General types

import { PrismaClient } from "@prisma/client";

export type MessageComponentInteractionHandler<T> = {
	[prefix: string]: (interaction: T, prisma: PrismaClient) => Promise<void>;
};

export interface Chore {
	summary: string;
	fn: () => Promise<void>;
	complete: string;
}
