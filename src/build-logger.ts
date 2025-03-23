import { type Level, type Logger, pino } from 'pino';

type buildLoggerOptions = {
    name: string;
    silent?: boolean;
    verbose?: boolean;
};
export const buildLogger = (options: buildLoggerOptions): Logger => {
    const name = options.name;
    const silent = options.silent ?? false;
    const verbose = options.verbose ?? false;

    let level: Level = 'info';

    if (silent) {
        level = 'fatal';
    } else if (verbose) {
        level = 'debug';
    }

    return pino({
        name,
        level,
        transport: {
            targets: [
                {
                    target: 'pino-pretty',
                    options: { colorize: true },
                },
            ],
        },
    });
};
