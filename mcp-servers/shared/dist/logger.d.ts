import winston from 'winston';
export declare const logger: winston.Logger;
export declare const logSync: {
    start: (supplier: string, sessionId: string) => void;
    progress: (supplier: string, current: number, total: number) => void;
    complete: (supplier: string, sessionId: string, stats: {
        added: number;
        updated: number;
        duration: number;
    }) => void;
    error: (supplier: string, sessionId: string, error: Error) => void;
    warning: (supplier: string, message: string) => void;
};
export default logger;
