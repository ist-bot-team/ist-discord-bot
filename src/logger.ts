import pino from "pino";

const logger = pino({
	level: process.env.NODE_ENV === "development" ? "trace" : "info",
});

export default logger;
