// Misc. utilities

import { performance } from "perf_hooks";

export async function timeFunction(fun: () => Promise<void>): Promise<number> {
	const t0 = performance.now();
	await fun();
	const t1 = performance.now();
	return Math.round((t1 - t0 + Number.EPSILON) * 100) / 100;
}
