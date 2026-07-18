---
applies_to: [v3, v4]
---

# Getting Started — Overview

> Quick navigation to every "Getting Started" page across the Native Federation sections — pick the one that matches what you're building.

Native Federation consists of two components — a **builder** for the remotes (micro frontends), and a **runtime** for the shell/host.

The builder itself splits in two: a [Core](core/index.md) that does the heavy lifting, and a bundler-specific [Adapter](adapters/index.md) (Angular, esbuild, …) that wires the Core into your build pipeline. The runtime comes in two flavours: the classic [Runtime](runtime/index.md), or the newer [Orchestrator](orchestrator/index.md) with semver-aware version resolution and cross-reload caching.

Each piece has its own getting-started page — pick the one that matches what you're building.

## Build a remote

- [Core — Getting Started](core/getting-started.md) — install `@softarc/native-federation` and wire the core builder into a custom build script with a bundler adapter. _v4._
- [esbuild Adapter — Getting Started](adapters/esbuild/getting-started.md) — install the esbuild adapter and build your first React remote end-to-end. _v4._
- [Angular Adapter — Getting Started](angular-adapter/getting-started.md) — scaffold a host and a remote with `ng add` in minutes. _v4._

## Load remotes on a host at runtime

- [Orchestrator — Getting Started](orchestrator/getting-started.md) — the drop-in quickstart bundle, the event registry, and writing your own `initFederation` script. _v3 & v4._
- [Classic Runtime — Getting Started](runtime/getting-started.md) — install `@softarc/native-federation-runtime`, add `es-module-shims`, split your bootstrap, and load your first remote module. _v3 & v4._

## New to Native Federation?

If you've landed here without context, start with the conceptual pages first:

- [Architecture Overview](architecture.md) — how Core, Adapters, Runtime and Orchestrator fit together.
- [The Mental Model](mental-model.md) — hosts, remotes, shared dependencies, and version handling.
- [Terminology](terminology.md) — the vocabulary used across the docs.
- [v3 vs v4](v3-vs-v4.md) — when to use which, and what changed.
