// ShellExecutor.ts

import { $, type ShellOutput } from 'bun';

/**
 * Options to control shell command execution.
 */
export interface ShellExecutorOptions {
    quiet?: boolean;
    shouldThrow?: boolean;
}

/**
 * An interface representing a shell command executor.
 */
export interface IShellExecutor {
    /**
     * Executes a shell command.
     *
     * @param cmd - The command string to execute.
     * @param options - Execution options.
     * @returns A promise resolving to ShellOutput.
     */
    exec(cmd: string, options?: ShellExecutorOptions): Promise<ShellOutput>;
}

/**
 * Default implementation of IShellExecutor using Bun's `$` function.
 */
export class BunShellExecutor implements IShellExecutor {
    async exec(cmd: string, options: ShellExecutorOptions = {}): Promise<ShellOutput> {
        let command = $`${{ raw: cmd }}`;
        if (options.quiet) {
            command = command.quiet();
        }
        if (!options.shouldThrow) {
            command = command.nothrow();
        }
        return command;
    }
}
