import { describe, expect, it } from 'bun:test';
import { $ } from 'bun';

const TIMEOUT = 360000;

describe('build-image script integration', () => {
    const tagName = 'test-cache';
    it(
        'should build the image successfully with demucs installed',
        async () => {
            $.nothrow();

            // Run the build-image script with the generated tag and --no-push flag.
            const buildResult = await $`./scripts/build-image -t ${tagName} --no-push`.quiet();

            // Assert that the build script exited with code 0.
            expect(buildResult.exitCode).toBe(0);

            // Verify that the image exists using docker inspect.
            const inspectResult = await $`docker inspect voxextractlabs/vox-demucs:${tagName}`.quiet();
            expect(inspectResult.exitCode).toBe(0);

            const runResult = await $`docker run --rm voxextractlabs/vox-demucs:${tagName} demucs /app/test.mp3`;
            expect(runResult.exitCode).toBe(0);

            // delete the image
            await $`docker rmi voxextractlabs/vox-demucs:${tagName}`.quiet();
        },
        TIMEOUT,
    );
});
