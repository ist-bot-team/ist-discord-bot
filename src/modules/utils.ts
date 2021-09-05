// Misc. utilities

import { performance } from "perf_hooks";

import { PrismaClient } from "@prisma/client";
import * as Discord from "discord.js";

export async function timeFunction(fun: () => Promise<void>): Promise<number> {
	const t0 = performance.now();
	await fun();
	const t1 = performance.now();
	return Math.round((t1 - t0 + Number.EPSILON) * 100) / 100;
}

export function getConfigFactory(
	prisma: PrismaClient,
	scope: string
): (key: string, throwIfMissing?: boolean) => Promise<string | undefined> {
	return async (key: string, throwIfMissing?: boolean) => {
		const result = (
			await prisma.config.findFirst({ where: { key: `${scope}:${key}` } })
		)?.value;
		if (throwIfMissing && result === undefined) {
			throw new Error(`Missing config "${scope}:${key}"`);
		}
		return result;
	};
}

export function divmod(a: number, b: number): [number, number] {
	return [Math.floor(a / b), a % b];
}

export function durationString(time: number): string {
	time = Math.round(time / 1000); // ms -> secs
	let tmp;
	const strs: string[] = [],
		seps: { [label: string]: number } = {
			day: 24 * 60 * 60,
			hour: 60 * 60,
			min: 60,
			sec: 1,
		};
	for (const [label, secs] of Object.entries(seps)) {
		[tmp, time] = divmod(time, secs);
		if (tmp) {
			strs.push(tmp + " " + label + (tmp === 1 ? "" : "s"));
		}
	}
	return strs.join(", ");
}

export async function fetchGalleries(
	prisma: PrismaClient
): Promise<Discord.Snowflake[]> {
	return (
		(await prisma.config.findFirst({ where: { key: "gallery_channels" } }))
			?.value ?? ""
	).split(",");
}
