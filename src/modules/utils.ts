// Misc. utilities

import { performance } from "perf_hooks";

export async function timeFunction(fun: () => Promise<void>): Promise<number> {
	const t0 = performance.now();
	await fun();
	const t1 = performance.now();
	return Math.round((t1 - t0 + Number.EPSILON) * 100) / 100;
}

export function getCustomIdComponents(customId: string): [string, string] {
	const sp = customId.split(":");
	return [sp[0], sp[1]];
}
