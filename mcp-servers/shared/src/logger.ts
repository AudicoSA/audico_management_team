import winston from 'winston';
import chalk from 'chalk';

const logFormat = winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        logFormat
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                logFormat
            )
        })
    ]
});

export const logSync = {
    start: (supplier: string, sessionId: string) => {
        logger.info(chalk.blue(`🚀 Starting sync for ${supplier} (Session: ${sessionId})`));
    },
    progress: (supplier: string, current: number, total: number) => {
        logger.info(chalk.cyan(`⏳ ${supplier}: Processed ${current}/${total}`));
    },
    complete: (supplier: string, sessionId: string, stats: any) => {
        logger.info(chalk.green(`✅ Sync complete for ${supplier}`));
        logger.info(chalk.green(`   Added: ${stats.added}, Updated: ${stats.updated}`));
        logger.info(chalk.green(`   Duration: ${stats.duration}s`));
    },
    error: (supplier: string, error: any) => {
        logger.error(chalk.red(`❌ Sync failed for ${supplier}: ${error.message}`));
    }
};
