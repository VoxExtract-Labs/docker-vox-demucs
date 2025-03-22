import { describe, expect, it } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { $ } from 'bun';

describe('build-image script integration', () => {
    it('should build the image successfully', async () => {
        $.nothrow();
        // Generate a unique tag name.
        const tagName = `test-${randomBytes(8).toString('hex')}`;

        // Run the build-image script with the generated tag and --no-push flag.
        const buildResult = await $`./scripts/build-image -t ${tagName} --no-push`.quiet();

        // Assert that the build script exited with code 0.
        expect(buildResult.exitCode).toBe(0);

        // Verify that the image exists using docker inspect.
        const inspectResult = await $`docker inspect voxextractlabs/vox-demucs:${tagName}`.quiet();
        expect(inspectResult.exitCode).toBe(0);

        // Clean up: Remove the image.
        const rmiResult = await $`docker rmi voxextractlabs/vox-demucs:${tagName}`.quiet();
        // Optionally, check that the removal succeeded (exit code 0).
        expect(rmiResult.exitCode).toBe(0);
    }, 20000);

    it('should have demucs installed', async () => {
        $.nothrow();
        const tagName = `test-${randomBytes(8).toString('hex')}`;
        const buildResult = await $`./scripts/build-image -t ${tagName} --no-push`;
        expect(buildResult.exitCode).toBe(0);

        const runResult = await $`docker run -it --rm voxextractlabs/vox-demucs:${tagName} demucs /app/test.mp3`;
        expect(runResult.exitCode).toBe(0);

        const rmiResult = await $`docker rmi voxextractlabs/vox-demucs:${tagName}`;
        expect(rmiResult.exitCode).toBe(0);
    }, 360000);
});
