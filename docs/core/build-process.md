---
applies_to: [v4]
---

# Build Process

> The federationBuilder lifecycle — init, build and close — plus watch-mode rebuilds, caching and build notifications.

The `federationBuilder` object is the entry point for the core build. It wraps the underlying steps (normalize config, compute externals, bundle shared and exposed modules, write artifacts) behind three methods: `init`, `build`, `close`.

## Lifecycle Overview

1. **`init(params)`** — load and normalize `federation.config.js`, register the bundler adapter, decide which packages are externals, and attach a federation cache. Exposes the `externals` list so your bundler step can exclude them.
2. *Your own bundler step* — compile your application entry points. Pass `federationBuilder.externals` as externals so shared packages aren't inlined.
3. **`build(opts?)`** — bundle every shared external (once, with caching), every shared mapped path, and every exposed module, then write `remoteEntry.json` and the import map. When called again on the same builder instance it performs an incremental rebuild.
4. **`close()`** — dispose the underlying adapter (closes contexts, stops watchers, flushes caches).

## Minimal Example

```js
import * as esbuild from 'esbuild';
import * as path from 'path';
import { esBuildAdapter } from '@softarc/native-federation-esbuild';
import { federationBuilder } from '@softarc/native-federation';

await federationBuilder.init({
  options: {
    workspaceRoot: path.join(__dirname, '..'),
    outputPath: 'dist/shell',
    tsConfig: 'tsconfig.json',
    federationConfig: 'shell/federation.config.js',
    verbose: false,
  },
  adapter: esBuildAdapter,
});

await esbuild.build({
  entryPoints: ['shell/main.ts'],
  outdir: 'dist/shell',
  bundle: true,
  format: 'esm',
  external: federationBuilder.externals,
});

await federationBuilder.build();
await federationBuilder.close();
```

## The `FederationOptions` Object

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `workspaceRoot` | `string` | yes | Absolute path to the monorepo / workspace root. All other paths are resolved against it. |
| `outputPath` | `string` | yes | Directory for federation artifacts (shared bundles, `remoteEntry.json`, import map). |
| `federationConfig` | `string` | yes | Path (relative to `workspaceRoot`) to `federation.config.js`. |
| `projectName` | `string` | no | Overrides the project name used for cache isolation. Defaults to the `name` field of the federation config. |
| `tsConfig` | `string` | no | Path to `tsconfig.json`. Used to resolve mapped paths. |
| `packageJson` | `string` | no | Override the `package.json` used by `shareAll` for dependency discovery. |
| `entryPoints` | `string[]` | no | Additional entry points considered when `ignoreUnusedDeps` is enabled. Defaults to the values of `exposes`. |
| `dev` | `boolean` | no | Development mode — influences bundling and enables the build-notifications endpoint. |
| `watch` | `boolean` | no | Hint to the adapter that it should set up watch mode. |
| `verbose` | `boolean` | no | Verbose logging. |
| `cacheExternalArtifacts` | `boolean` | no | Cache built shared externals across builds (default `true`). |
| `buildNotifications` | `BuildNotificationOptions` | no | Configures the dev-only notification endpoint that tells the runtime to reload on rebuild. |

## Incremental Builds

The first call to `federationBuilder.build()` performs a full build. Every subsequent call on the same builder instance is treated as a rebuild and only re-runs what has changed:

```js
// initial build
await federationBuilder.build();

// file-change notification from your watcher
await federationBuilder.build({
  modifiedFiles: ['/abs/path/to/mfe1/component.ts'],
  signal: abortController.signal,
});
```

Rebuilds reuse the federation cache — already-bundled shared externals are skipped unless their checksum changes. Pass an `AbortSignal` to cancel a build mid-flight (e.g. when a newer file change arrives).

## Caching Shared Externals

Shared externals are the slowest part of a federation build, so the core caches them by default under `node_modules/.cache/native-federation/<projectName>`. On a cache hit the build adapter is never invoked for that bundle — the outputs are copied from the cache and their metadata is merged into `remoteEntry.json`.

- Disable it with `cacheExternalArtifacts: false` on `FederationOptions`.
- Supply your own cache via `normalizeFederationOptions(options, cache)` or `createFederationCache(path, bundlerCache?)`.

For the full mechanics — what counts as a cache hit, the checksum format, the cache layout, how to invalidate it — see [Caching](caching.md).

## Accessors on `federationBuilder`

| Accessor | Available after | Description |
| --- | --- | --- |
| `externals` | `init` | Array of package names to pass as `external` to your bundler. |
| `config` | `init` | The normalized federation config. |
| `federationInfo` | `build` | The last `FederationInfo` object that was written to `remoteEntry.json`. |

## Dev-mode Build Notifications

When `dev: true` and `buildNotifications.enable: true`, the core writes a `buildNotificationsEndpoint` into `remoteEntry.json`. The runtime subscribes to that endpoint and triggers a refresh when a rebuild finishes, giving you a fast HMR-like experience without rebuilding the host.

## What Happens Inside `build()`

Under the hood, `build()` runs three phases (logged verbosely when `verbose: true`):

1. **Shared externals** — `bundleShared` groups shared packages by `platform` (browser / node) and by `build` mode (`default`, `separate`, `package`). Each group is bundled via the adapter and cached.
2. **Exposed modules & mapped paths** — `bundleExposedAndMappings` bundles every `exposes` entry plus every shared mapped path from your `tsconfig`.
3. **Artifact writing** — `writeFederationInfo` emits `remoteEntry.json`; `writeImportMap` emits the import map the runtime consumes.

See [Build Artifacts](artifacts.md) for the shape of the generated files.
