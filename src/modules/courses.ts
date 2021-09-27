// Controller for everything courses

import { PrismaClient } from "@prisma/client";

import * as Discord from "discord.js";
import { OrphanChannel } from "./courses.d";

export async function refreshCourses(
	prisma: PrismaClient,
	guild: Discord.Guild
): Promise<OrphanChannel[]>;
