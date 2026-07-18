---
applies_to: [v4]
---

# Caching

> How Native Federation caches bundled shared externals between builds — the checksum, the cache layout, and how to control or invalidate it.

Bundling every shared external on every build — all of Angular, every time you hit save — would make Native Federation unusable. The core ships a content-addressed cache for shared externals that is on by default and does most of the heavy lifting behind the scenes. This page explains exactly what is cached, how cache hits are decided, and how to control or invalidate the cache.

**On this page**

- [What is cached](#what-is-cached)
- [Cache location](#cache-location)
- [The checksum](#the-checksum)
- [The cache meta file](#the-cache-meta-file)
- [Cache hit vs. miss](#cache-hit-vs-miss)
- [Dev and prod caches](#dev-and-prod-caches)
- [Controlling the cache](#controlling-the-cache)
- [Invalidation & recovery](#invalidation--recovery)
- [Observability](#observability)

## What is cached

Only **shared externals** are cached — never your exposed modules, never your app entry points. That's on purpose: shared externals are stable (one npm version stays put for weeks), while your own source changes on every keystroke. Scoping the cache to externals keeps it simple and safe.

Caching happens per *bundle*, not per package. A bundle is a group of externals that the core hands to the build adapter in one pass:

- `browser-shared` — every `build: 'default'` browser external.
- `node-shared` — every `build: 'default'` node external.
- `browser-<package>` / `node-<package>` — one bundle per package declared with `build: 'separate'` or `build: 'package'`.

Each bundle owns its own cache key, so bumping one isolated package doesn't invalidate the others.

## Cache location

By default the cache lives under the workspace's `node_modules` folder, isolated per project (by the `name` field in `federation.config.js`):

```
node_modules/.cache/native-federation/<projectName>/
```

Inside you'll find the bundle's emitted `.js` files plus one `.meta.json` per bundle:

```
node_modules/.cache/native-federation/mfe1/
├── browser-shared.meta.json
├── browser-shared-dev.meta.json        # dev cache lives side-by-side
├── node-shared.meta.json
├── _angular_core.CH1f-PL9lh.js
├── _angular_core_primitives_di.63DUUDHkzv.js
├── _angular_core_primitives_signals.5PqDyOp3np.js
├── chunk-IXOA6WTM.js
├── chunk-WDE5IQ2F.js
└── chunk-2VMXMS7J.js
```

Because the cache is scoped by project name, two remotes in the same monorepo don't stomp on each other. If `name` is missing, the core falls back to `'shell'` and logs a warning — with multiple nameless projects that fallback *will* cause collisions.

## The checksum

A cache hit is decided by a SHA-256 checksum of everything that affects the bundle's output. Per bundle, the core builds a deterministic key by:

1. sorting the package names in the bundle alphabetically,
2. concatenating each `<packageName>@<version>` pair,
3. appending a `dev=0` or `dev=1` flag,
4. hashing the result with SHA-256.

A concrete example, before hashing:

```
deps:@angular/core@21.0.6:@angular/core/primitives/di@21.0.6:@angular/core/primitives/signals@21.0.6:dev=0
```

As long as every package in the bundle keeps the same version, the checksum is stable and the cache is reused. Bumping any package, adding a new one, or flipping between dev and prod invalidates only the bundles that actually contain that change.

## The cache meta file

Each bundle produces one meta file, e.g. `browser-shared.meta.json`. It's the record the core consults on the next build:

```json
{
  "checksum": "071b3e8776554ee81b8266b5ae574e2e4f6db39f253ee7bb680a1a25c79ae237",
  "externals": [
    {
      "packageName": "@angular/core",
      "outFileName": "_angular_core.CH1f-PL9lh.js",
      "requiredVersion": "^21.0.6",
      "singleton": true,
      "strictVersion": true,
      "version": "21.0.6"
    },
    {
      "packageName": "@angular/core/primitives/di",
      "outFileName": "_angular_core_primitives_di.63DUUDHkzv.js",
      "requiredVersion": "^21.0.6",
      "singleton": true,
      "strictVersion": true,
      "version": "21.0.6"
    },
    {
      "packageName": "@nf-internal/chunk-IXOA6WTM",
      "outFileName": "chunk-IXOA6WTM.js",
      "singleton": false,
      "strictVersion": false,
      "requiredVersion": "0.0.0",
      "version": "0.0.0"
    }
  ],
  "files": [
    "_angular_core.CH1f-PL9lh.js",
    "_angular_core_primitives_di.63DUUDHkzv.js",
    "chunk-IXOA6WTM.js"
  ]
}
```

Three fields matter:

- **`checksum`** — compared against a freshly computed one on the next build.
- **`externals`** — inlined into `remoteEntry.json` on a cache hit, so the manifest is identical to what a cold build would have produced.
- **`files`** — the list the core copies out of the cache folder into `outputPath/`.

## Cache hit vs. miss

At the start of each bundle phase, the core:

1. Computes the fresh checksum for the bundle.
2. Reads the stored meta file, if any, and compares its `checksum`.
3. **If they match** — cache hit. The build adapter is never invoked. The cached `files` are copied straight into the output directory, and the cached `externals` are added to the in-memory `FederationCache`.
4. **If they differ** — cache miss. The core clears the stale entries, calls the adapter to rebuild the bundle, and persists a new meta file.

A first-ever build, a version bump, a new shared package, or a dev/prod flip all look like a miss on the affected bundle. Everything else is a hit.

## Dev and prod caches

The `dev` flag is folded into the checksum and the filename (`browser-shared-dev.meta.json` vs. `browser-shared.meta.json`), so development and production artifacts are kept in parallel. Switching modes doesn't invalidate the other half of the cache — a prod build right after a dev run is still warm.

## Controlling the cache

Caching is on by default. Toggle it on `FederationOptions`:

```js
await federationBuilder.init({
  options: {
    workspaceRoot: __dirname,
    outputPath: 'dist/mfe1',
    federationConfig: 'mfe1/federation.config.js',
    cacheExternalArtifacts: true,   // default; set to false to opt out
  },
  adapter: esBuildAdapter,
});
```

For tighter control — e.g. sharing cache state across multiple builds in the same process — construct a cache yourself and thread it through the low-level API:

```js
import {
  createFederationCache,
  normalizeFederationOptions,
  getExternals,
  buildForFederation,
} from '@softarc/native-federation';

const cache = createFederationCache('.nf-cache');

const { config, options } = await normalizeFederationOptions(fedOptions, cache);
const externals = getExternals(config);
await buildForFederation(config, options, externals);
```

Adapters use the `bundlerCache` slot on `FederationCache` to persist bundler-specific state (e.g. an esbuild `context`) across rebuilds — one more layer of warm-start work on top of the file-level cache described here.

## Invalidation & recovery

Versions change far more often than the skip list or build modes, so the checksum is deliberately narrow: it folds in *only* the packages and their versions. That means a few edits that you'd expect to invalidate the cache don't, on their own — for example changing `singleton` on an already-bundled external, or tweaking `includeSecondaries` filters in a way that doesn't add or remove packages from the bundle.

If a build ever produces surprising output and you suspect a stale entry, wipe the cache folder and let the next build recreate it:

```bash
rm -rf node_modules/.cache/native-federation
```

For a single project, delete only that project's subfolder:

```bash
rm -rf node_modules/.cache/native-federation/mfe1
```

There is no built-in "force rebuild one bundle" flag — deleting the corresponding `.meta.json` is the manual way.

## Observability

Run with `verbose: true` on `FederationOptions` to see the cache decisions inline with the build:

```
DBG! 00:00:387.914ms - To load the federation config.
INFO Building federation artefacts
DBG! 00:00:779.642ms - [build artifacts] - To bundle all mappings and exposed.
DBG! Checksum of browser-shared matched, Skipped artifact bundling
DBG! 00:00:008.745ms - [build artifacts] - To bundle all shared browser externals
DBG! 00:00:788.998ms - To build the artifacts.
```

The `Checksum of <bundle> matched, Skipped artifact bundling` line is the signal that the cache did its job. When it's missing, the build went through the adapter.

## See also

- [Build Process](build-process.md) — where caching fits in the `federationBuilder` lifecycle.
- [Build Artifacts](artifacts.md) — the shape of the files the cache produces.
- [Build modes](configuration.md#build-modes-on-a-shared-entry) — how `build: 'default' | 'separate' | 'package'` decides which cache bundle a package lands in.
