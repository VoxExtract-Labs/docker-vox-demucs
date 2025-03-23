import { describe, expect, it } from 'bun:test';
import { Buffer } from 'node:buffer';
import { BuildImage, type ImageSummary } from '@docker-vox-demucs/BuildImage';
import type { IShellExecutor, ShellExecutorOptions } from '@docker-vox-demucs/ShellExecutor';
import type { ShellOutput } from 'bun';

/**
 * Creates a dummy ShellOutput object that satisfies the ShellOutput interface.
 *
 * @param textValue - The text value to be returned by the text() method.
 * @returns A ShellOutput object with dummy implementations.
 */

/**
 * Creates a dummy ShellOutput object that satisfies the ShellOutput interface.
 *
 * @param textValue - The text value to be returned by the text() method.
 * @returns A ShellOutput object with dummy implementations.
 */
function createDummyShellOutput(textValue: string): ShellOutput {
    return {
        exitCode: 0,
        // Provide Buffer instances for stdout and stderr.
        stdout: Buffer.from(textValue),
        stderr: Buffer.from(''),
        text: () => textValue,
        json: () => ({}),
        // Return an ArrayBuffer synchronously, not wrapped in a Promise.
        arrayBuffer: () => new ArrayBuffer(0),
        bytes: () => new Uint8Array(),
        blob: () => new Blob([]),
    };
}

// Create a stub for IShellExecutor.
class StubShellExecutor implements IShellExecutor {
    exec(cmd: string, options?: ShellExecutorOptions): Promise<ShellOutput> {
        if (cmd.includes('docker build')) {
            return Promise.resolve(createDummyShellOutput('Build successful'));
        }
        if (cmd.includes('docker inspect')) {
            const fakeInspect = [
                {
                    Id: 'fake-id-123',
                    Os: 'linux',
                    Author: 'Test Author',
                    Size: 4200000000,
                    VirtualSize: 4300000000,
                    Created: '2023-03-21T12:00:00Z',
                },
            ];
            return Promise.resolve(createDummyShellOutput(JSON.stringify(fakeInspect)));
        }
        if (cmd.includes('docker push')) {
            return Promise.resolve(createDummyShellOutput('Push successful'));
        }
        return Promise.resolve(createDummyShellOutput(''));
    }
}

describe('BuildImage', () => {
    const stubExecutor = new StubShellExecutor();

    it('normalizes tag name', () => {
        const options = { tagName: 'Feature/My New Branch', skipCache: false, silent: false, verbose: false };
        const builder = new BuildImage(options, stubExecutor);
        expect(builder.tagName).toBe('feature-my-new-branch');
    });

    it('builds an image and returns an ImageSummary', async () => {
        const options = { tagName: 'Test-Tag', skipCache: false, silent: false, verbose: false };
        const builder = new BuildImage(options, stubExecutor);
        const summary = await builder.buildImage();
        expect(summary.imageName).toBe('voxextractlabs/vox-demucs');
        expect(summary.tag).toBe('test-tag');
        expect(summary.id).toBe('fake-id-123');
        expect(summary.os).toBe('linux');
        expect(summary.author).toBe('Test Author');
        expect(summary.size).toBe('4.2 GB');
        expect(summary.virtualSize).toBe('4.3 GB');
        expect(summary.created).not.toBe('');
    });

    it('pushes an image and returns push output', async () => {
        const options = { tagName: 'Test-Tag', skipCache: false, silent: false, verbose: false };
        const builder = new BuildImage(options, stubExecutor);
        const output = await builder.pushImage();
        expect(output).toContain('Push successful');
    });
});
