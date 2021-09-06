// Misc. utilities

import { performance } from "perf_hooks";

import { PrismaClient } from "@prisma/client";

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
