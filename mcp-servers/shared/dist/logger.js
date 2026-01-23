"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSync = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const { combine, timestamp, printf, colorize, errors } = winston_1.default.format;
// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
});
// Create logger instance
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    transports: [
        new winston_1.default.transports.Console({
            format: combine(colorize(), logFormat),
        }),
        new winston_1.default.transports.File({
            filename: 'logs/error.log',
            level: 'error',
        }),
        new winston_1.default.transports.File({
            filename: 'logs/combined.log',
        }),
    ],
});
// Helper functions for structured logging
exports.logSync = {
    start: (supplier, sessionId) => {
        exports.logger.info(`🚀 Starting sync for ${supplier} (Session: ${sessionId})`);
    },
    progress: (supplier, current, total) => {
        exports.logger.info(`⏳ ${supplier}: ${current}/${total} products processed`);
    },
    complete: (supplier, sessionId, stats) => {
        exports.logger.info(`✅ ${supplier} sync completed (Session: ${sessionId})\n` +
            `   Added: ${stats.added}, Updated: ${stats.updated}\n` +
            `   Duration: ${stats.duration}s`);
    },
    error: (supplier, sessionId, error) => {
        exports.logger.error(`❌ ${supplier} sync failed (Session: ${sessionId}): ${error.message}`, { stack: error.stack });
    },
    warning: (supplier, message) => {
        exports.logger.warn(`⚠️  ${supplier}: ${message}`);
    },
};
exports.default = exports.logger;
