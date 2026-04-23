---
applies_to: [v4]
---

# esbuild Adapter

> The esbuild adapter — a framework-agnostic Native Federation adapter, used by the React reference example.

The `@softarc/native-federation-esbuild` package is a thin, framework-agnostic adapter that plugs the [core builder](../../core/index.md) into esbuild. It powers the React reference example and can be used with any stack where you drive your own build script — there is no CLI wrapper or framework coupling.

> **Note:** If you are on Angular, use the [Angular adapter](../../angular-adapter/index.md) instead — it wraps this adapter and adds builder, schematics and dev-server integration. This section is for projects (React, Preact, Lit, plain TypeScript, …) that drive esbuild themselves.

## What's in the Box

| Piece | Entry point | Purpose |
| --- | --- | --- |
| **Builder** | `runEsBuildBuilder(configPath, options)` | High-level entry point. Loads `federation.config.js`, runs the initial build, and — when `watch: true` — wires up the file watcher and rebuild queue. See [Builder](builder.md). |
| **Low-level adapter** | `createEsBuildAdapter(config)` | Returns an `NFBuildAdapter` (`setup` / `build` / `dispose`) for users who want to drive `buildForFederation` directly. See [Build Adapters](../../core/build-adapters.md). |
| **Build options** | `EsBuildBuilderOptions` | Workspace-level options: `outputPath`, `tsConfig`, `entryPoints`, `dev`, `watch`, `cachePath`, … See [Builder](builder.md). |
| **Adapter config** | `EsBuildAdapterConfig` | esbuild-specific extension points: `plugins`, `fileReplacements`, `compensateExports`, `loader`. See [Configuration](configuration.md). |

## Why an Adapter?

The [core builder](../../core/index.md) is intentionally bundler-agnostic — it orchestrates the federation build and delegates the actual bundling to an [`NFBuildAdapter`](../../core/build-adapters.md). The esbuild adapter is that bridge for esbuild:

- **Two bundling modes** — source-code entries (your exposed modules) and node-modules entries (shared dependencies) are bundled with different esbuild configurations. Shared dependencies always go through `@chialab/esbuild-plugin-commonjs` and get `process.env.NODE_ENV` defined, so CommonJS libraries Just Work.
- **File writes + cache integration** — esbuild runs with `write: false`; the adapter writes outputs into `outputPath` and tracks every input file through the core's federation cache, so watch-mode rebuilds only touch what changed.
- **Watch mode** — wraps `esbuild.context()` with a debounced `RebuildQueue`, an `AbortSignal`-aware rebuild loop, and the core file watcher. Cancelled rebuilds are aborted cleanly rather than racing.
- **CJS/ESM interop knobs** — `fileReplacements` lets you swap problematic CJS entry points for their pre-bundled variants (e.g. React's `cjs/` files), and `compensateExports` routes selected packages through the core's export-compensation pass.

## Install

```bash
npm i -D esbuild @softarc/native-federation @softarc/native-federation-esbuild
```

On the host page, you also want the orchestrator runtime for import-map + remote loading:

```bash
npm i @softarc/native-federation-orchestrator
```

## In this Section

- [Getting Started](getting-started.md) — walk through the React reference example end-to-end: `federation.config.js`, `build.mjs`, host page and run commands.
- [Builder](builder.md) — reference for `runEsBuildBuilder` and every field of `EsBuildBuilderOptions`, plus the lower-level `createEsBuildAdapter`.
- [Adapter Configuration](configuration.md) — `EsBuildAdapterConfig`: extra esbuild `plugins`, `fileReplacements`, `compensateExports` and custom `loader` mappings.
- [React & CommonJS Interop](react-interop.md) — why React needs extra care, the CJS plugin, the canonical `fileReplacements` map, `shareAll` overrides, and the Shadow-DOM custom-element pattern.

## Prerequisites

- **Node 18+** — the adapter is ESM-only and uses top-level `await` in typical build scripts.
- **`"type": "module"`** in your project's `package.json` — the adapter and its entry points are native ESM.
- **esbuild ≥ 0.25** as a peer — the adapter imports `esbuild` directly rather than bundling a copy.
- **`@softarc/native-federation` ~4.0.0** — the core package is a peer dependency; the adapter calls `buildForFederation` / `rebuildForFederation` from it.

> **Note:** A complete working example lives at [native-federation-examples-react](https://github.com/Aukevanoost/native-federation-examples-react/) — React 18 + esbuild + Shadow-DOM custom element + orchestrator host page.
