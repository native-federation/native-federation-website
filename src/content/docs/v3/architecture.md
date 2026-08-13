# Architecture Overview

> A bird's-eye view of Native Federation — how the Core, Adapters and Runtime fit together to enable framework-agnostic Micro Frontends.

Native Federation is organized into three cooperating layers. Each has a single responsibility and a narrow contract with its neighbors — so you can replace any one of them (your framework, your bundler, or your runtime) without touching the others.

## The Three Layers

| Layer | Lives at | Runs | Responsibility |
| --- | --- | --- | --- |
| [**Core**](core/index.md) | `@softarc/native-federation` | build time | Normalizes the federation config, bundles shared dependencies and exposed modules, and emits `remoteEntry.json` + `importmap.json`. Bundler-agnostic. |
| [**Adapters**](adapters/index.md) | Angular / esbuild / Vite … | build time | Plug a specific bundler or framework into the Core via the `BuildAdapter` contract. Often ship a higher-level API, schematics or CLI integration on top. |
| [**Runtime**](runtime/index.md) | in the browser | run time | Reads `remoteEntry.json` files, constructs a combined import map, and loads remote modules on demand. Small and framework-agnostic. |

A fourth piece exists but is optional here: the [Orchestrator](orchestrator/index.md), v4's browser runtime. It reads the same `remoteEntry.json` contract, so a v3 host can swap it in for semver-range resolution and persistent caching.

## How They Fit Together

```
                 ┌─────────────────────┐      plugs in      ┌────────────┐
                 │         Core        │ ◄───────────────── │  Adapter   │
                 │ (federationBuilder) │                    │  (esbuild, │
                 │                     │ ──────────────────►│  Angular)  │
                 └──────────┬──────────┘   delegates build  └────────────┘
                            │
                            │ emits remoteEntry.json + exposed and shared bundles
                            │
                            ▼
          ┌──────────────────────────────────────┐
          │               Runtime                │
          │ (initFederation, loadRemoteModule)   │
          └──────────────────────────────────────┘
                         in the browser
```

Each layer gets its own section elsewhere in these docs. The short version:

- **[Core](core/index.md)** — bundler-agnostic builder. Normalizes the federation config, computes the externals your own bundler must leave unresolved, bundles shared dependencies and exposed modules, and writes `remoteEntry.json` + `importmap.json`.
- **[Adapters](adapters/index.md)** — framework-/bundler-specific glue implementing the `BuildAdapter` contract. First-party adapters exist for [Angular](angular-adapter/index.md) and [esbuild](adapters/esbuild/index.md); there is a community [Vite plugin](https://www.npmjs.com/package/@gioboa/vite-module-federation), and [you can build your own](core/build-adapters.md).
- **[Runtime](runtime/index.md)** — the browser library. Exposes `initFederation` and `loadRemoteModule`.

## Build Steps

At a very high level, building a Native Federation micro frontend goes through five stages. The Core orchestrates; the Adapter does the actual bundling.

1. **Init & normalize** — the Core loads `federation.config.js`, merges it with the project's `FederationOptions` and `package.json`, and registers the Adapter.
2. **Compute externals** — derive the list of shared packages and `tsconfig` path mappings that the host bundler must leave unresolved, so the browser can later wire them through the import map.
3. **Bundle exposed modules & mapped paths** — compile every `exposes` entry plus any monorepo-internal libraries referenced via `paths`, via the Adapter.
4. **Bundle shared dependencies** — split shared entries by platform (`browser` / `node`) and bundling strategy (`default` / `separate`), then hand each group to the Adapter. Results are checksum-cached so unchanged externals are reused on the next build.
5. **Emit federation artifacts** — write `remoteEntry.json` (name, shared metadata, exposes) and `importmap.json` into the project's output folder. These two files are the full contract the Runtime consumes.

## A Full Build-to-Runtime Trace

1. Your build pipeline invokes the Native Federation build for `shell` and `mfe1`, each with their own `FederationOptions`.
2. For each project, the **Core** reads `federation.config.js`, normalizes it, and asks the **Adapter** to bundle exposed modules, mapped paths and shared externals.
3. The Core writes `dist/<project>/remoteEntry.json` and `dist/<project>/importmap.json`.
4. The `dist` folders are published behind stable URLs.
5. At startup, the **Runtime** in `shell` fetches `mfe1`'s `remoteEntry.json`, merges the shared-dependency metadata, and injects a combined import map into the document.
6. When the user navigates to a route backed by a remote, `loadRemoteModule` dynamically imports the exposed module — the browser resolves it through the injected import map.

> **Note:** If you only remember one thing: the Core and Runtime speak a simple contract — `remoteEntry.json` plus an import map. Everything else (which bundler, which framework, which runtime) is swappable.

## Where to Go Next

- [The Mental Model](mental-model.md) — why the pieces are shaped this way.
- [Terminology](terminology.md) — canonical glossary for the terms used above.
- [Coming from Module Federation?](example.md) — the working reference implementation, ported from the webpack Module Federation example.
