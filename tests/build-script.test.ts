import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { $ } from 'bun';

const TIMEOUT = 360000;

describe('build-image script integration', () => {
    $.nothrow();

    const tagName = 'test-cache';

    const deleteImage = async () => {
        await $`docker rmi voxextractlabs/vox-demucs:${tagName}`.quiet();
    };

    beforeEach(async () => {
        await deleteImage();
    });

    afterEach(async () => {
        await deleteImage();
    });

    it(
        'should build the image successfully',
        async () => {
            // Run the build-image script with the generated tag and --no-push flag.
            const buildResult = await $`./scripts/build-image -t ${tagName} --no-push`.quiet();

            // Assert that the build script exited with code 0.
            expect(buildResult.exitCode).toBe(0);

            // Verify that the image exists using docker inspect.
            const inspectResult = await $`docker inspect voxextractlabs/vox-demucs:${tagName}`.quiet();
            expect(inspectResult.exitCode).toBe(0);
        },
        TIMEOUT,
    );

    it(
        'should have demucs installed',
        async () => {
            const buildResult = await $`./scripts/build-image -t ${tagName} --no-push`;
            expect(buildResult.exitCode).toBe(0);

            const runResult = await $`docker run --rm voxextractlabs/vox-demucs:${tagName} demucs /app/test.mp3`;
            expect(runResult.exitCode).toBe(0);
        },
        TIMEOUT,
    );
});
