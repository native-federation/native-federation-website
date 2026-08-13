---
applies_to: [v3, v4]
---

# Getting Started — Overview

Native Federation is a set of tools to build decentralized micro frontends architectures. It consists of two components — a **builder** for the remotes (micro frontends), and a **runtime** for the shell/host.

The builder itself splits in two: a [Core](core/index.md) that does the heavy lifting, and a bundler-specific [Adapter](adapters/index.md) (Angular, esbuild, …) that wires the Core into your build pipeline. On the host side that runtime is the [Orchestrator](orchestrator/index.md), with semver-aware version resolution and cross-reload caching; the classic [Runtime](runtime/index.md) it replaces is deprecated and end-of-life.

To help you find the right information, we broke the information up into sections: "Getting started" gives you an overview of how the components work together, the "orchestrator" part shows you how you can hook native-federation into your (existing) application. The "core" part shows how native-federation builds your remotes and how you can influence/optimize the build process. Finally, the adapters are for your specific setup. We provide first-class support for Angular but we're also providing some options for your favorite framework/setup. The lightweight "esbuild" adapter is your general jack-of-all-trades that will work with most frameworks, but if you need more customizability, BYOA! (build your own adapter).

## Build a remote

- [Core — Getting Started](core/getting-started.md) — install `@softarc/native-federation` and wire the core builder into a custom build script with a bundler adapter. _v4._
- [esbuild Adapter — Getting Started](adapters/esbuild/getting-started.md) — install the esbuild adapter and build your first React remote end-to-end. _v4._
- [Angular Adapter — Getting Started](angular-adapter/getting-started.md) — scaffold a host and a remote with `ng add` in minutes. _v4._

## Load remotes on a host at runtime

- [Orchestrator — Getting Started](orchestrator/getting-started.md) — the drop-in quickstart bundle, the event registry, and writing your own `initFederation` script. _v3 & v4._
- [Angular Adapter — Runtime](angular-adapter/runtime.md) — the Angular bootstrap split, threading the loader through DI, and dynamic remotes. _v4 (v3 on its [own page](angular-adapter/runtime-v3.md))._

## New to Native Federation?

If you've landed here without context, start with the conceptual pages first:

- [Architecture Overview](architecture.md) — how Core, Adapters, Runtime and Orchestrator fit together.
- [The Mental Model](mental-model.md) — hosts, remotes, shared dependencies, and version handling.
- [Terminology](terminology.md) — the vocabulary used across the docs.
- [v3 vs v4](v3-vs-v4.md) — when to use which, and what changed.
