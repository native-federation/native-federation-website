# Architecture Overview

> A bird's-eye view of Native Federation — how the Core, Adapters, Runtime and Orchestrator fit together to enable framework-agnostic Micro Frontends.

Native Federation is organized into four cooperating layers. Each has a single responsibility and a narrow contract with its neighbors — so you can replace any one of them (your framework, your bundler, or your runtime) without touching the others.

## The Four Layers

| Layer | Lives at | Runs | Responsibility |
| --- | --- | --- | --- |
| [**Core**](core/index.md) | `@softarc/native-federation` | build time | Normalizes the federation config, bundles shared dependencies and exposed modules, and emits `remoteEntry.json` + the import map. Bundler-agnostic. |
| [**Adapters**](adapters/index.md) | Angular / esbuild / Vite … | build time | Plug a specific bundler or framework into the Core via the `NFBuildAdapter` contract. Often ship a higher-level API, schematics or CLI integration on top. |
| [**Runtime**](runtime/index.md) | in the browser | run time | Reads `remoteEntry.json` files, constructs a combined import map, and loads remote modules on demand. Small, framework-agnostic. |
| [**Orchestrator**](orchestrator/index.md) | in the browser | run time | The next-generation runtime, intended to replace the default Runtime. Same `remoteEntry.json` contract, plus semver-range resolution for shared dependencies and persistent caching in browser storage. Client-side only — no direct SSR support yet. |

## How They Fit Together

```
                 ┌─────────────────────┐      plugs in      ┌────────────┐
                 │         Core        │ ◄───────────────── │  Adapter   │
                 │ (federationBuilder) │                    │  (esbuild, │
                 │                     │ ──────────────────►│  Angular)  │
                 └──────────┬──────────┘   delegates build  └────────────┘
                            │
                            │ exposes remoteEntry.json + remotes + shared external bundles
                            │
                            ▼
          ┌──────────────────────────────────────┐
          │   Runtime   ─or─   Orchestrator      │
          │ (initFederation, loadRemoteModule)   │
          └──────────────────────────────────────┘
                         in the browser
```

Each layer gets its own section elsewhere in these docs. The short version:

- **[Core](core/index.md)** — bundler-agnostic builder. Normalizes the federation config, computes the externals your own bundler must leave unresolved, bundles shared dependencies and exposed modules, and writes `remoteEntry.json` + `importmap.json`.
- **[Adapters](adapters/index.md)** — framework-/bundler-specific glue implementing the `NFBuildAdapter` contract. First-party adapters exist for [Angular](angular-adapter/index.md) and [esbuild](adapters/esbuild/index.md); there is a community [Vite plugin](https://www.npmjs.com/package/@gioboa/vite-module-federation), and [you can build your own](adapters/build-your-own.md).
- **[Runtime](runtime/index.md)** — the small default browser library. Exposes `initFederation` and `loadRemoteModule`.
- **[Orchestrator](orchestrator/index.md)** — the recommended browser runtime for v4. Same API as the Runtime, plus semver-range resolution and persistent `remoteEntry.json` caching. Client-side only today; keep the default Runtime for SSR.

## Build Steps

At a very high level, building a Native Federation micro frontend goes through five stages. The Core orchestrates; the Adapter does the actual bundling.

1. **Init & normalize** — the Core loads `federation.config.(m)js`, merges it with the project's `FederationOptions` and `package.json`, and registers the Adapter.
2. **Compute externals** — derive the list of shared packages and `tsconfig` path mappings that the host bundler must leave unresolved, so the browser can later wire them through the import map.
3. **Bundle shared dependencies** — split shared entries by platform (`browser` / `node`) and bundling strategy (`default` / `package` / `separate`), then hand each group to the Adapter. Results are checksum-cached so unchanged externals are reused on the next build.
4. **Bundle exposed modules & mapped paths** — compile every `exposes` entry plus any monorepo-internal libraries referenced via `paths`, again via the Adapter.
5. **Emit federation artifacts** — write `remoteEntry.json` (name, shared metadata, exposes, chunks) and `importmap.json` into the project's `dist` folder. These two files are the full contract the Runtime / Orchestrator consumes.

## A Full Build-to-Runtime Trace

1. Your build pipeline invokes the Native Federation build for `shell` and `mfe1`, each with their own `FederationOptions`.
2. For each project, the **Core** reads `federation.config.(m)js`, normalizes it, and asks the **Adapter** to bundle shared externals, mapped paths, and exposed modules.
3. The Core writes `dist/<project>/remoteEntry.json` and `dist/<project>/importmap.json`.
4. The `dist` folders are published behind stable URLs.
5. At startup, the **Runtime** (or the **Orchestrator**) in `shell` fetches `mfe1`'s `remoteEntry.json`, merges shared-dependency metadata, resolves version mismatches, and injects a combined import map into the document.
6. When the user navigates to a route backed by a remote, `loadRemoteModule` dynamically imports the exposed module — the browser resolves it through the injected import map.

> **Note:** If you only remember one thing: the Core and Runtime speak a simple contract — `remoteEntry.json` plus an import map. Everything else (which bundler, which framework, which runtime) is swappable.

## Where to Go Next

- [The Mental Model](mental-model.md) — why the pieces are shaped this way.
- [Terminology](terminology.md) — canonical glossary for the terms used above.
- [Example Repo](example.md) — pointer to the working reference implementation.
