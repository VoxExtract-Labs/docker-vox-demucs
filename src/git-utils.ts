import { $ } from 'bun';

// Returns the current branch name by executing a Git command.
export const getCurrentBranchName = async (): Promise<string> => {
    const output = await $`git rev-parse --abbrev-ref HEAD`.quiet().text();
    const branch = output.trim();
    if (!branch) {
        throw new Error('Could not determine Git branch name.');
    }
    return branch;
};
