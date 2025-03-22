import { describe, expect, it } from 'bun:test';
import { getCurrentBranchName } from '@docker-vox-demucs/git-utils';

describe('git-utils', () => {
    it('should return a non-empty branch name', async () => {
        const branch = await getCurrentBranchName();
        expect(typeof branch).toBe('string');
        expect(branch.length).toBeGreaterThan(0);
    });
});
