import { ButtonStyle } from "discord.js";

export function parseButtonStyle(style: string): ButtonStyle {
	switch (style) {
		case "PRIMARY":
		default:
			return ButtonStyle.Primary;
		case "SECONDARY":
			return ButtonStyle.Secondary;
		case "DANGER":
			return ButtonStyle.Danger;
		case "LINK":
			return ButtonStyle.Link;
		case "SUCCESS":
			return ButtonStyle.Success;
	}
}
