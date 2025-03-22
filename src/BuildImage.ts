import { $ } from 'bun';
import type { Logger } from 'pino';
import type { IShellExecutor } from './ShellExecutor.ts';
import { buildLogger } from './build-logger.ts';

/**
 * Summary information for a built Docker image.
 */
export type ImageSummary = {
    imageName: string;
    tag: string;
    id: string;
    os: string;
    author: string;
    size: string;
    virtualSize?: string;
    created: string;
};

/**
 * Options for building a Docker image.
 */
export type BuildImageOptions = {
    tagName: string;
    skipCache: boolean;
    silent: boolean;
    verbose: boolean;
};

/**
 * BuildImage encapsulates logic for building and pushing a Docker image.
 *
 * The image tag is normalized to lowercase with non-alphanumeric characters
 * replaced by dashes.
 */
export class BuildImage {
    public readonly imageName = 'voxextractlabs/vox-demucs';
    protected readonly options: BuildImageOptions;
    public readonly logger: Logger;
    protected readonly executor: IShellExecutor;

    /**
     * Constructs a BuildImage instance.
     *
     * @param options - Build options.
     * @param executor - A shell executor implementing IShellExecutor.
     */
    constructor(options: BuildImageOptions, executor: IShellExecutor) {
        // Normalize the tagName to lowercase and replace non-alphanumeric characters with dashes.
        this.options = {
            ...options,
            tagName: options.tagName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, ''),
        };
        // Initialize the logger using buildLogger.
        this.logger = buildLogger({
            name: 'ImageBuilder',
            verbose: this.options.verbose,
            silent: this.options.silent,
        });
        this.executor = executor;
    }

    /**
     * Returns the normalized tag name.
     *
     * @returns The Docker image tag.
     */
    get tagName(): string {
        return this.options.tagName;
    }

    /**
     * Returns whether to skip Docker build cache.
     *
     * @returns True if cache should be skipped.
     */
    get skipCache(): boolean {
        return this.options.skipCache;
    }

    /**
     * Indicates if the build should be silent.
     *
     * @returns True if silent mode is enabled.
     */
    get isSilent(): boolean {
        return this.options.silent;
    }

    /**
     * Builds the Docker image by executing a Docker build command.
     *
     * @returns A promise that resolves to an ImageSummary object.
     * @throws Error if the Docker build fails.
     */
    public async buildImage(): Promise<ImageSummary> {
        this.logger.info({ image: this.imageName, tag: this.tagName }, 'Building Docker image');

        const buildResult = await this.executor.exec(`docker build -t ${this.imageName}:${this.tagName} ./docker`, {
            // Use quiet mode if silent is set.
            quiet: this.isSilent,
            shouldThrow: !this.isSilent,
        });
        if (buildResult.exitCode !== 0) {
            throw new Error(`Docker build failed: ${buildResult.stderr}`);
        }

        const res = await this.executor.exec(`docker inspect ${this.imageName}:${this.tagName}`, { quiet: true });
        const inspectOutput = res.text();

        const inspectData = JSON.parse(inspectOutput)[0];
        const summary: ImageSummary = {
            imageName: this.imageName,
            tag: this.tagName,
            id: inspectData.Id,
            os: inspectData.Os,
            author: inspectData.Author,
            size: inspectData.Size.toString(),
            virtualSize: inspectData.VirtualSize ? inspectData.VirtualSize.toString() : '0',
            created: new Date(inspectData.Created).toLocaleString(),
        };
        this.logger.info(summary, 'Build Summary');
        return summary;
    }

    /**
     * Pushes the built Docker image.
     *
     * @returns A promise that resolves to the push command's output as a string.
     * @throws Error if the Docker push fails.
     */
    public async pushImage(): Promise<string> {
        this.logger.info({ image: this.imageName, tag: this.tagName }, 'Pushing Docker image');
        const pushResult = await this.executor.exec(`docker push ${this.imageName}:${this.tagName}`, { quiet: true });
        if (pushResult.exitCode !== 0) {
            throw new Error(`Docker push failed: ${pushResult.stderr}`);
        }
        const result = pushResult.text();
        this.logger.info(result, 'Push Result');
        return result;
    }

    /**
     * Lints the Docker file
     *
     * @returns a promise of the lint output
     * @throws Error if the lint has errors ( warnings are OK)
     */
    public async lint() {
        this.logger.info('Linting Docker file');

        // Execute Hadolint via Docker using the provided command
        const result = await this.executor.exec(
            'docker run --rm --entrypoint=hadolint hadolint/hadolint --failure-threshold=error - < ./docker/Dockerfile',
            {
                quiet: true,
                shouldThrow: false,
            },
        );

        // Trim the output for a cleaner log message
        const output = result.text().trim();

        if (result.exitCode !== 0) {
            this.logger.error(`Linting failed with exit code ${result.exitCode}:\n${output}`);
            throw new Error(output);
        }
        this.logger.info(`Linting passed:\n${output}`);

        return output;
    }
}
