FROM ghcr.io/cachix/devenv/devcontainer:latest

# Must match workspaceFolder / the compose volume so devenv's eval cache is reused
WORKDIR /workspace

# Only the files that define the environment, so this layer stays cached
# until they change. Add any files devenv.nix imports.
COPY devenv.nix devenv.yaml devenv.lock ./

# Realise the whole shell closure into /nix at build time.
# `build shell` skips enterShell (uv sync / npm install), which would fail
# here because data_generation/ and mongo/ aren't copied into the image.
# The base image's /nix is root-owned and nix-daemon only starts in the
# entrypoint, which doesn't run during `docker build`. Build as root so nix
# can open the store directly, then drop back to the image's user.
USER root
RUN devenv build shell && rm -rf /tmp/devenv-* /workspace/.devenv
USER vscode