// utils/logger.js
import winston from "winston";
import path from "path";

// Define log format
const logFormat = winston.format.combine(
	winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
	winston.format.errors({ stack: true }),
	winston.format.splat(),
	winston.format.printf(({ level, message, timestamp, service, ...meta }) => {
		const metaStr = Object.keys(meta).length
			? JSON.stringify(meta, null, 2)
			: "";
		return `${timestamp} [${
			service || "server"
		}] ${level.toUpperCase()}: ${message} ${metaStr}`;
	}),
	winston.format.colorize({ all: true })
);

// Create the logger instance
const logger = winston.createLogger({
	level: process.env.LOG_LEVEL || "info",
	format: logFormat,
	defaultMeta: { service: "karaoke-gigante-api" },
	transports: [
		// Console transport for all logs
		new winston.transports.Console(),

		// File transport for error logs
		new winston.transports.File({
			filename: path.join(process.cwd(), "logs", "error.log"),
			level: "error",
			mkdir: true,
		}),

		// File transport for combined logs
		new winston.transports.File({
			filename: path.join(process.cwd(), "logs", "combined.log"),
			mkdir: true,
		}),
	],
});

// Create a stream object for Morgan integration (if needed later)
logger.stream = {
	write: message => {
		logger.info(message.trim());
	},
};

export default logger;
