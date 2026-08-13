# Getting Started — Overview

Native Federation is a set of tools to build decentralized micro frontends architectures. It consists of two components — a **builder** for the remotes (micro frontends), and a **runtime** for the shell/host.

The builder itself splits in two: a [Core](core/index.md) that does the heavy lifting, and a bundler-specific [Adapter](adapters/index.md) (Angular, esbuild, …) that wires the Core into your build pipeline. On the host side, the [Runtime](runtime/index.md) reads every remote's `remoteEntry.json`, merges them into one import map, and resolves `loadRemoteModule()` against it.

To help you find the right information, we broke the information up into sections: "Getting started" gives you an overview of how the components work together, the "runtime" part shows you how you can hook native-federation into your (existing) application. The "core" part shows how native-federation builds your remotes and how you can influence/optimize the build process. Finally, the adapters are for your specific setup. We provide first-class support for Angular but we're also providing some options for your favorite framework/setup. The lightweight "esbuild" adapter is your general jack-of-all-trades that will work with most frameworks, but if you need more customizability, BYOA! (build your own adapter).

> **Note:** This is the documentation for **v3**. The current major is v4 — see [v3 vs v4](/docs/v4/v3-vs-v4/) for what changed and [Migration to v4](/docs/v4/migration/) for the upgrade.

## Build a remote

- [Core — Getting Started](core/getting-started.md) — install `@softarc/native-federation` and wire the core builder into a custom build script with a bundler adapter.
- [esbuild Adapter — Getting Started](adapters/esbuild/getting-started.md) — install the esbuild adapter and build your first remote end-to-end.
- [Angular Adapter — Getting Started](angular-adapter/getting-started.md) — scaffold a host and a remote with `ng add` in minutes.

## Load remotes on a host at runtime

- [Runtime — Getting Started](runtime/getting-started.md) — `es-module-shims`, the bootstrap split, `initFederation` and `loadRemoteModule`.
- [Angular Adapter — Runtime](angular-adapter/runtime.md) — the same surface as Angular hosts consume it; the v3 adapter re-exports the runtime unchanged.
- [Orchestrator](orchestrator/index.md) — the v4 runtime, and when it is worth opting into on v3.

## New to Native Federation?

If you've landed here without context, start with the conceptual pages first:

- [Architecture Overview](architecture.md) — how Core, Adapters and the Runtime fit together.
- [The Mental Model](mental-model.md) — hosts, remotes, shared dependencies, and version handling.
- [Terminology](terminology.md) — the vocabulary used across the docs.
- [v3 vs v4](/docs/v4/v3-vs-v4/) — when to use which, and what changed.
