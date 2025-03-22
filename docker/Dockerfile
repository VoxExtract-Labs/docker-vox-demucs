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
