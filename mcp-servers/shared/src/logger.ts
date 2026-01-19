import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

// Helper functions for structured logging
export const logSync = {
  start: (supplier: string, sessionId: string) => {
    logger.info(`🚀 Starting sync for ${supplier} (Session: ${sessionId})`);
  },

  progress: (supplier: string, current: number, total: number) => {
    logger.info(`⏳ ${supplier}: ${current}/${total} products processed`);
  },

  complete: (
    supplier: string,
    sessionId: string,
    stats: { added: number; updated: number; duration: number }
  ) => {
    logger.info(
      `✅ ${supplier} sync completed (Session: ${sessionId})\n` +
        `   Added: ${stats.added}, Updated: ${stats.updated}\n` +
        `   Duration: ${stats.duration}s`
    );
  },

  error: (supplier: string, sessionId: string, error: Error) => {
    logger.error(
      `❌ ${supplier} sync failed (Session: ${sessionId}): ${error.message}`,
      { stack: error.stack }
    );
  },

  warning: (supplier: string, message: string) => {
    logger.warn(`⚠️  ${supplier}: ${message}`);
  },
};

export default logger;
