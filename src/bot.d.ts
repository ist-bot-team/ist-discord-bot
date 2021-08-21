// General types

import { PrismaClient } from "@prisma/client";

export type MessageComponentInteractionHandler<T> = {
	[prefix: string]: (interaction: T, prisma: PrismaClient) => Promise<void>;
};
