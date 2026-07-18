---
applies_to: [v4]
---

# Core

> Native Federation Core — the language-agnostic builder library that powers hosts, remotes and adapters across any framework or bundler.

The core package — `@softarc/native-federation` — is the bundler- and framework-agnostic builder library that sits at the heart of Native Federation. Every adapter (Angular, esbuild, Vite, …) is built on top of it.

> **Note:** This section covers the v4 core. For a full overview of what changed since v3 — packages, ESM, repositories — see [v3 vs v4](../v3-vs-v4.md).

## What the Core Does

Given a federation config and a pluggable bundler adapter, the core library:

- Resolves and normalizes your `federation.config.js` — including shared dependencies, mapped paths, and skip lists.
- Bundles every **shared** external (and, optionally, its secondary entry points) into standalone EcmaScript modules.
- Bundles every **exposed** module and every **shared mapped path** from your `tsconfig`.
- Writes a `remoteEntry.json` describing exposes, shared packages and chunks — the contract between host and remote.
- Writes a local `importmap.json` that the runtime hands to the browser to wire everything together.
- Caches already-built shared dependencies (keyed by checksum) so subsequent builds are fast.

## Where It Fits

The core defines two contracts — a [federation config](configuration.md) (what to share and expose) and a [build adapter](build-adapters.md) (how to invoke the bundler) — and lets everything else plug in. For how it relates to the Adapter, Runtime and Orchestrator layers, see the [Architecture Overview](../architecture.md).

## In this section

- [Getting Started](getting-started.md) — install the package and wire it into a build script.
- [`federation.config.js`](configuration.md) — the complete reference for every field, feature flag and tweak.
- [Sharing Dependencies](sharing.md) — `share`, `shareAll`, secondary entry points, pseudo-treeshaking and the downsides of sharing.
- [Build Process](build-process.md) — the `federationBuilder` lifecycle.
- [Caching](caching.md) — the content-addressed cache that keeps warm builds fast.
- [Build Adapters](build-adapters.md) — the `NFBuildAdapter` contract, plus [Build Your Own Adapter](../adapters/build-your-own.md).
- [Build Artifacts](artifacts.md) — `remoteEntry.json`, the import map and the cache layout.
- [API Reference](api-reference.md) — the public exports of `@softarc/native-federation`.

> **Note:** If you are building an application (rather than an adapter) you'll usually consume the core through an adapter. The [Angular adapter](../angular-adapter/index.md) and [esbuild adapter](../adapters/esbuild/index.md) both hide the core entirely behind higher-level APIs.
