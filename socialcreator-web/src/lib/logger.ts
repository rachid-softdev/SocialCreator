import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "userId",
      "*.userId",
      "user.id",
      "*.user.id",
      "accessToken",
      "*.accessToken",
      "refreshToken",
      "*.refreshToken",
      "token",
      "*.token",
      "secret",
      "*.secret",
      "email",
      "*.email",
      "password",
      "*.password",
      "ip",
      "*.ip",
    ],
    censor: "[REDACTED]",
  },
});

export default logger;
