// In BuildImage.ts or a separate DockerUtils.ts module:
import { $ } from 'bun';

export async function verifyDockerInstalled(): Promise<void> {
    try {
        // This will throw if docker is not found or fails.
        await $`docker --version`.quiet();
    } catch (error) {
        throw new Error(
            'Docker does not appear to be installed or accessible. Please ensure Docker is installed and running.',
        );
    }
}
