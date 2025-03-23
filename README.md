# docker-vox-demucs

A Docker image build for VoxExtract-Labs' Vox Demucs project.  
This repository contains a multi-stage Dockerfile that sets up a CUDA-enabled Ubuntu environment, installs Demucs and its dependencies, and pre-downloads the default model for audio source separation. Although the image is primarily for internal use by the VoxExtract Labs team, the repository is public to support integration with the upcoming Vox Demucs npm module.

---

## Project Structure

```text
.
├── README.md                     # This file
├── biome.json                    # Biome configuration for linting/formatting
├── bun.lockb                     # Bun lockfile
├── commitlint.config.cjs         # Commitlint configuration
├── docker                        # Docker build context
│   ├── Dockerfile                # Multi-stage Dockerfile for building the image
│   └── test.mp3                  # Sample audio file for pre-downloading models and testing
├── docker-compose.yml            # Example Docker Compose file (see below)
├── input                         # Directory for input data
├── lefthook.yml                  # Lefthook configuration for Git hooks
├── models                        # Directory for cached models
│   └── hub
│       └── checkpoints         # Pre-downloaded model checkpoints
│           └── 955717e8-8726e21a.th
├── output                        # Directory for output data
├── package.json                  # Project metadata, scripts, and dependencies
├── scripts                       # Helper scripts
│   ├── build-image             # Script to build (and optionally push) the Docker image
│   └── lint-docker-file        # Script to lint the Dockerfile (using hadolint)
├── src                           # Source code for Docker build logic
│   ├── BuildImage.ts           # Main class for building and pushing the Docker image
│   ├── ShellExecutor.ts        # Shell executor interface and Bun implementation
│   ├── build-logger.ts         # Logger configuration using pino and pino-pretty
│   ├── git-utils.ts            # Git utilities (e.g., getCurrentBranchName)
│   └── verifyDockerInstalled.ts# Utility to verify Docker is installed
├── tests                         # Test files
│   ├── BuildImage.test.ts      # Unit tests for the BuildImage class
│   ├── build-script.test.ts    # Integration tests for the build-image script
│   └── git-utils.test.ts       # Unit tests for git-utils
└── tsconfig.json                 # TypeScript configuration
```

---

## Project Description

This repository builds a Docker image for Vox Demucs that:

- **Base Image:** Uses `nvidia/cuda:12.4.1-base-ubuntu22.04` to provide CUDA support on an Ubuntu environment.
- **System Dependencies:** Installs `ffmpeg`, `python3`, `python3-pip`, and `git`.
- **Python Dependencies:** Upgrades pip and installs pinned versions of `numpy` (less than version 2) and `torchaudio` (≥0.8, <2.0).
- **Demucs Installation:** Installs Demucs directly from its maintained GitHub repository.
- **Pre-download Step:** Copies a sample audio file (`test.mp3`) and runs Demucs to pre-download the default model.
- **Volumes:**
    - `/data/models`: For caching downloaded models.
    - `/data/input`: For input data.
    - `/data/output`: For output data.
- **Run Behavior:** The container is designed to remain running (using `tail -f /dev/null`) for interactive use or further testing.

---

## Available Scripts

### Build-Image Script (`./scripts/build-image`)

A Bun script that builds the Docker image. It offers the following options:

- **`--tag` (`-t`):**  
  Specifies the image tag. If not provided, the current Git branch name is used.
- **`--no-cache`:**  
  Boolean flag to disable the Docker build cache.
- **`--push` (`-p`):**  
  Boolean flag to automatically push the built image.
- **`--no-push`:**  
  Boolean flag that, if provided, ensures the image is not pushed (overrides `--push`).
- **`--verbose` (`-v`):**  
  Enables verbose logging.
- **`--quiet` (`-q`):**  
  Runs the script in quiet mode (reduces output and interactive prompts).

The script first verifies that Docker is installed (using `src/verifyDockerInstalled.ts`), then instantiates the `BuildImage` class (from `src/BuildImage.ts`) using the `BunShellExecutor` (from `src/ShellExecutor.ts`). It builds the image, and based on the provided flags, may prompt to push the image or automatically push it.

### Lint-Docker-File Script (`./scripts/lint-docker-file`)

A Bun script that lints the Dockerfile using Hadolint. It uses the same underlying logic as the build-image script (including verifying Docker is installed) and calls the `lint()` method from the `BuildImage` class.

### NPM Scripts (Defined in `package.json`)

- **`lint`:**  
  Runs Biome linting on the project files.
- **`lint:fix`:**  
  Runs Biome to check and fix lint issues.
- **`prepare`:**  
  Installs Git hooks using Lefthook (skips installation in CI).
- **`docker:build`:**  
  Shortcut to run the build-image script.

---

## Dockerfile Overview

The Dockerfile (located in `docker/Dockerfile`) uses a multi-stage build to create a minimal runtime image.

### Stage 1: Builder

```dockerfile
# Stage 1: Builder
FROM nvidia/cuda:12.4.1-base-ubuntu22.04 AS builder
LABEL maintainer="Angel S. Moreno <angelxmoreno@gmail.com>"

USER root
ENV TORCH_HOME=/data/models
ENV OMP_NUM_THREADS=1
ENV TORCHAUDIO_USE_BACKEND_DISPATCHER=1

RUN apt-get update && apt-get install -y --no-install-recommends \
ffmpeg \
python3 \
python3-pip \
git \
&& rm -rf /var/lib/apt/lists/*

# Upgrade pip and pin numpy and torchaudio to compatible versions before installing Demucs.
RUN python3 -m pip install --upgrade pip && \
python3 -m pip install --no-cache-dir "numpy<2" "torchaudio>=0.8,<2.0" && \
python3 -m pip install --no-cache-dir git+https://github.com/adefossez/demucs
```

### Stage 2: Final Runtime Image

```dockerfile
# Stage 2: Final runtime image
FROM nvidia/cuda:12.4.1-base-ubuntu22.04
LABEL maintainer="Angel S. Moreno <angelxmoreno@gmail.com>"

USER root
ENV TORCH_HOME=/data/models
ENV OMP_NUM_THREADS=1
ENV TORCHAUDIO_USE_BACKEND_DISPATCHER=1

RUN apt-get update && apt-get install -y --no-install-recommends \
ffmpeg \
python3 \
python3-pip \
&& rm -rf /var/lib/apt/lists/*

# Copy installed packages from the builder stage.
COPY --from=builder /usr/local /usr/local

WORKDIR /app
RUN mkdir -p tests

# Pre-download step: copy a valid test audio file and run Demucs to pre-download models.
COPY test.mp3 /app/test.mp3
RUN python3 -m demucs -d cpu /app/test.mp3 && rm -rf separated

# Define volumes for model caching and I/O data.
VOLUME /data/models
VOLUME /data/input
VOLUME /data/output

# Keep container running.
CMD ["tail", "-f", "/dev/null"]
```

---

## Docker Compose Example

```yaml
version: "3.8"
services:
  vox-demucs:
    image: voxextractlabs/vox-demucs:latest
    volumes:
      - ./models:/data/models
      - ./input:/data/input
      - ./output:/data/output
    environment:
      - TORCH_HOME=/data/models
      - OMP_NUM_THREADS=1
      - TORCHAUDIO_USE_BACKEND_DISPATCHER=1
    command: [ "/bin/bash", "-c", "tail -f /dev/null" ]
```

**Explanation:**

- **Volumes:**  
  Local directories (`./models`, `./input`, `./output`) are mapped to the container for persistent storage.
- **Environment Variables:**  
  Necessary variables for the container are defined.
- **Command:**  
  The container runs indefinitely, allowing interactive access if needed.

---

## Testing

### Test Files

- **`tests/BuildImage.test.ts`:**  
  Unit tests for the `BuildImage` class using stubbed shell commands.
- **`tests/build-script.test.ts`:**  
  Integration tests for the build-image script. These tests verify that:
    - The image is built successfully.
    - The image exists (using `docker inspect`).
    - Demucs is installed (by running it inside the container).
    - The image is cleaned up after tests.
- **`tests/git-utils.test.ts`:**  
  Unit tests for Git utilities (e.g., `getCurrentBranchName`).

### Running Tests

Run all tests using:

```shell
bun test
```

Or run a specific test file:

```shell
bun test tests/build-script.test.ts
```

---

## Release & Versioning

Releases are managed using [release-please](https://github.com/googleapis/release-please), which automates changelog generation, version bumps, and the creation of release pull requests based on Conventional Commit messages. When you merge a release pull request, the corresponding git tag is created and a GitHub release is published.

You can manually trigger the release workflow using the [manual-release GitHub Action](.github/workflows/manual-release.yml).

---

## Tools & Technologies

- **Bun:** JavaScript/TypeScript runtime and bundler.
- **Docker & Docker Compose:** For building and running the CUDA-enabled Demucs image.
- **Git:** For version control and branch/tag management.
- **Pino & Pino-Pretty:** For structured logging.
- **@inquirer/prompts:** For interactive CLI prompts.
- **Biome:** For linting and formatting code.
- **Commitlint & Lefthook:** For enforcing commit message conventions and Git hooks.
- **release-please:** For automated release management (integrated via GitHub Actions).

**Standard Tool Versions:**

- Bun: 1.1.18
- Node (for release-please): 16.x
- CUDA Base Image: `nvidia/cuda:12.4.1-base-ubuntu22.04`

---

## Contributing

While we don't have formal CONTRIBUTING guidelines at this time, all contributions are welcome. Please follow the commit message conventions defined in `commitlint.config.cjs` and review the Git hooks configured via Lefthook (`lefthook.yml`).

---

## License

This project is released under the [MIT License](LICENSE).

---

This README provides an overview of the project structure, description, available scripts, Dockerfile details, Docker Compose usage, testing, release management, tools, and licensing.
