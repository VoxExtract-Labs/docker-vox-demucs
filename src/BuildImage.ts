import type { Logger } from 'pino';
import prettyBytes from 'pretty-bytes';
import type { IShellExecutor } from './ShellExecutor.ts';
import { buildLogger } from './build-logger.ts';

/**
 * Summary information for a built Docker image.
 */
export type ImageSummary = {
    /** The Docker repository name. */
    imageName: string;
    /** The tag associated with the image. */
    tag: string;
    /** The unique identifier (ID) for the image. */
    id: string;
    /** The operating system on which the image is based. */
    os: string;
    /** The author of the image. */
    author: string;
    /** The human-readable size of the image. */
    size: string;
    /** The human-readable virtual size of the image, if available. */
    virtualSize?: string;
    /** The creation date of the image in a localized string format. */
    created: string;
};

/**
 * Options for building a Docker image.
 */
export type BuildImageOptions = {
    /** The desired tag for the image. */
    tagName: string;
    /** If true, the Docker build will skip using the cache. */
    skipCache: boolean;
    /** If true, suppresses non-error output during execution. */
    silent: boolean;
    /** If true, provides verbose logging for debugging purposes. */
    verbose: boolean;
};

/**
 * BuildImage encapsulates the logic for building, linting, and pushing a Docker image.
 *
 * The image tag is normalized to lowercase with non-alphanumeric characters replaced by dashes.
 *
 * @example
 * const options: BuildImageOptions = { tagName: 'v1.0.0', skipCache: false, silent: false, verbose: true };
 * const executor: IShellExecutor = new ShellExecutor();
 * const builder = new BuildImage(options, executor);
 *
 * builder.buildImage()
 *   .then(summary => console.log('Build complete:', summary))
 *   .catch(err => console.error('Build failed:', err));
 */
export class BuildImage {
    /** The Docker repository name. */
    public readonly imageName = 'voxextractlabs/vox-demucs';
    /** Build options with normalized tag name. */
    protected readonly options: BuildImageOptions;
    /** Logger instance configured via buildLogger. */
    public readonly logger: Logger;
    /** Shell executor instance for running commands. */
    protected readonly executor: IShellExecutor;

    /**
     * Constructs a BuildImage instance.
     *
     * @param options - Build options that include the tag, cache, and verbosity settings.
     * @param executor - An object implementing IShellExecutor to run shell commands.
     */
    constructor(options: BuildImageOptions, executor: IShellExecutor) {
        // Normalize the tagName to lowercase and replace non-alphanumeric characters with dashes.
        this.options = {
            ...options,
            tagName: options.tagName
                .toLowerCase()
                .replace(/[^a-z0-9.\-]+/g, '-')
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
     * Gets the normalized Docker image tag.
     *
     * @returns The normalized tag string.
     */
    get tagName(): string {
        return this.options.tagName;
    }

    /**
     * Indicates whether the Docker build should skip using the cache.
     *
     * @returns True if the build should skip cache usage; otherwise, false.
     */
    get skipCache(): boolean {
        return this.options.skipCache;
    }

    /**
     * Indicates if the build process should run in silent mode.
     *
     * @returns True if silent mode is enabled; otherwise, false.
     */
    get isSilent(): boolean {
        return this.options.silent;
    }

    /**
     * Builds the Docker image by executing a Docker build command.
     *
     * This method logs the process and returns a summary of the built image.
     *
     * @param tagNameOverride - (Optional) Overrides the current tag with a different one for the push.
     * @returns A promise that resolves to an ImageSummary object containing build details.
     * @throws Will throw an error if the Docker build command exits with a non-zero code.
     */
    public async buildImage(tagNameOverride?: string): Promise<ImageSummary> {
        const tagName = tagNameOverride ?? this.tagName;
        this.logger.info({ image: this.imageName, tag: tagName }, 'Building Docker image');
        const noCacheArg = this.skipCache ? '--no-cache' : '';

        const buildResult = await this.executor.exec(
            `docker build ${noCacheArg} -t ${this.imageName}:${tagName} ./docker`,
            {
                // Use quiet mode if silent is set.
                quiet: this.isSilent,
                shouldThrow: !this.isSilent,
            },
        );
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
            size: prettyBytes(inspectData.Size),
            virtualSize: inspectData.VirtualSize ? prettyBytes(inspectData.VirtualSize) : '-',
            created: new Date(inspectData.Created).toLocaleString(),
        };
        this.logger.info(summary, 'Build Summary');
        return summary;
    }

    /**
     * Pushes the built Docker image to the remote registry.
     *
     * @param tagNameOverride - (Optional) Overrides the current tag with a different one for the push.
     * @returns A promise that resolves to the output of the Docker push command as a string.
     * @throws Will throw an error if the Docker push command exits with a non-zero code.
     */
    public async pushImage(tagNameOverride?: string): Promise<string> {
        const tagName = tagNameOverride ?? this.tagName;
        this.logger.info({ image: this.imageName, tag: tagName }, 'Pushing Docker image');
        const pushResult = await this.executor.exec(`docker push ${this.imageName}:${tagName}`, { quiet: true });
        if (pushResult.exitCode !== 0) {
            throw new Error(`Docker push failed: ${pushResult.stderr}`);
        }
        const result = pushResult.text();
        this.logger.info(result, 'Push Result');
        return result;
    }

    /**
     * Pushes the built Docker image using the "latest" tag.
     *
     * This is a convenience method for pushing the image with the "latest" tag.
     *
     * @returns A promise that resolves to the output of the Docker push command as a string.
     */
    public async pushLatest(): Promise<string> {
        await this.buildImage('latest');
        return this.pushImage('latest');
    }

    /**
     * Lints the Dockerfile using Hadolint via a Docker container.
     *
     * Executes the linting process and logs the output. Warnings do not trigger errors,
     * but if linting fails (exit code non-zero), an error is thrown.
     *
     * @returns A promise that resolves to the lint output as a string.
     * @throws Will throw an error if linting fails (exit code non-zero).
     */
    public async lint(): Promise<string> {
        this.logger.info('Linting Docker file');

        // Execute Hadolint via Docker using the provided command.
        const result = await this.executor.exec(
            'docker run --rm --entrypoint=hadolint hadolint/hadolint --failure-threshold=error - < ./docker/Dockerfile',
            {
                quiet: true,
                shouldThrow: false,
            },
        );

        // Trim the output for a cleaner log message.
        const output = result.text().trim();

        if (result.exitCode !== 0) {
            this.logger.error(`Linting failed with exit code ${result.exitCode}:\n${output}`);
            throw new Error(output);
        }
        this.logger.info(`Linting passed:\n${output}`);

        return output;
    }
}
