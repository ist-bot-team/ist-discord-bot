// Populate the database with mock/test/default values

import { PrismaClient } from "@prisma/client";

const populators = {
	degree_selection: async (prisma: PrismaClient) => {
		await prisma.roleGroup.create({
			data: {
				id: "degree",
				mode: "menu",
				placeholder: "Escolhe o teu curso",
				message:
					"Olá <@97446650548588544>!\n\n||(isto é uma mensagem)||",
				channelId: "859896451270574082",
				options: {
					create: [
						{
							label: "LEIC-A",
							description:
								"Licenciatura em Engenharia Informática e de Computadores - Alameda",
							value: "876961096253206542",
							emoji: "💻",
						},
						{
							label: "LEIC-T",
							description:
								"Licenciatura em Engenharia Informática e de Computadores - Taguspark",
							value: "876961212590587914",
							emoji: "🇹",
						},
						{
							label: "LEFT",
							description:
								"Licenciatura em Engenharia Física e Tecnológica",
							value: "876961271667372073",
							emoji: "⚛️",
						},
					],
				},
			},
		});
	},
	tourist: async (prisma: PrismaClient) => {
		const configs = {
			channel_id: "859896451270574082",
			message_id: "noid",
			message: "If you're a ~~terrible person~~ tourIST click below",
			label: "I'm not in IST",
			csv: "881601009300959282,876961096253206542,876961212590587914,876961271667372073",
		};

		const items = [];
		for (const [key, value] of Object.entries(configs)) {
			const fqkey = `tourist:${key}`;
			items.push(
				prisma.config.upsert({
					where: { key: fqkey },
					create: { key: fqkey, value },
					update: { value },
				})
			);
		}
		await prisma.$transaction(items);
	},
};

export async function populateDatabase(prisma: PrismaClient): Promise<void> {
	for (const [key, fn] of Object.entries(populators)) {
		const fqkey = `populated:${key}`;
		if (
			(await prisma.config.findFirst({ where: { key: fqkey } }))
				?.value !== "yes"
		) {
			await fn(prisma);
			await prisma.config.upsert({
				where: { key: fqkey },
				create: { key: fqkey, value: "yes" },
				update: { value: "yes" },
			});
		}
	}
}
