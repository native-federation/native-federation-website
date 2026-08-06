---
applies_to: [v4]
---

# API Reference

> The public API surface of @softarc/native-federation — exports from the main, /config and /domain entry points.

`@softarc/native-federation` exposes several import subpaths. The default entry covers the build-time API; `/config` is the configuration DSL; `/domain` re-exports the TypeScript contracts so adapter authors can type against them; `/internal` and `/internal/browser` hold semi-public utilities for adapter authors.

## `@softarc/native-federation`

Build-time API — everything you need to drive a federation build.

| Export | Kind | Summary |
| --- | --- | --- |
| `federationBuilder` | object | High-level builder with `init`, `build`, `close` and the `externals` / `config` / `federationInfo` accessors. See [Build Process](build-process.md). |
| `setBuildAdapter(adapter)` | function | Register a bundler adapter imperatively. `federationBuilder.init` calls this for you. |
| `buildForFederation(config, options, externals, signal?)` | function | Full build — bundles shared externals, mapped paths and exposed modules, then writes `remoteEntry.json` and the import map. |
| `rebuildForFederation(config, options, externals, modifiedFiles, signal?)` | function | Incremental rebuild. `federationBuilder.build` dispatches to this after the first full build. |
| `bundleExposedAndMappings(config, options, externals, ...)` | function | Bundles just the exposed modules and shared mapped paths. |
| `createFederationCache(cachePath, bundlerCache?)` | function | Construct a `FederationCache` — use this to share cache state across multiple builds. |
| `getExternals(config)` | function | Derive the list of externals (package names) from a normalized config. |
| `normalizeFederationOptions(options, cache?)` | function | Load and normalize the federation config and options, returning both. The low-level entry the `federationBuilder` calls internally. |
| `writeFederationInfo(info, options)` | function | Write a `FederationInfo` object to `remoteEntry.json`. |
| `BuildHelperParams` | type | Argument type for `federationBuilder.init`. |

## `@softarc/native-federation/config`

Configuration DSL used inside `federation.config.js`.

| Export | Kind | Summary |
| --- | --- | --- |
| `withNativeFederation(config)` | function | Normalize a user-supplied `FederationConfig` — applies defaults, prepares the skip list, resolves mapped paths. |
| `fromPackageJson(baseCfg, projectPath?)` | function | Recommended dep-sharing builder (since v4.3). Shares all `package.json` deps and returns a fluent builder (`.skip` / `.override` / `.patch` / `.get`). |
| `shareAll(options, opts?)` | function | Share every dependency found in `package.json`. Accepts `overrides` for per-package deviation. |
| `share(entries, projectPath?, skipList?)` | function | Share a hand-picked set of packages with per-entry options. |
| `mappingsFromWorkspace(baseCfg?)` | function | Since v4.4. Builder for `sharedMappings` — `.filter()` narrows the selection, `.patch()` annotates a subset, `.get()` returns the entry array. See [sharedMappings](configuration.md#mappingsfromworkspace). |
| `setInferVersion(fn)` | function | Override how shared-dependency versions are inferred for `requiredVersion: 'auto'`. |
| `findRootTsConfigJson()` | function | Locate the root `tsconfig.base.json` or `tsconfig.json` for mapped-path resolution. |
| `DEFAULT_SKIP_LIST` | const | The baseline skip list `withNativeFederation` merges with your `skip`. |

## `@softarc/native-federation/domain`

TypeScript contracts — types only. Useful when authoring an adapter or integrating at the type level.

- `FederationConfig`
- `ExternalConfig`, `SharedExternalsConfig`, `ShareExternalsOptions`, `ShareAllExternalsOptions`, `IncludeSecondariesOptions`
- `FederationOptions`, `NormalizedFederationOptions`
- `NFBuildAdapter`, `NFBuildAdapterOptions`, `NFBuildAdapterContext`, `NFBuildAdapterResult`, `EntryPoint`
- `FederationInfo`, `SharedInfo`, `ExposesInfo`, `ChunkInfo`, `ArtifactInfo`, `IntegrityMap`
- `FederationManifest` — the host manifest shape: `Record<string, string | { url; integrity?; main? }>`
- `FederationCache`
- `SkipList`, `SkipListEntry`, `SkipFn`, `PreparedSkipList`
- `BuildNotificationOptions`, `BuildNotificationType`

## `@softarc/native-federation/internal`

Utility exports intended for adapter authors. Treated as semi-public; breaking changes are possible across minor versions. Includes:

- error types and `AbortedError`,
- the `hashFile` checksum helper and `getChecksum` / `getDefaultCachePath` cache helpers,
- the `logger` and `setLogLevel`,
- the `RebuildQueue` plus the `createBuildResultMap` / `lookupInResultMap` / `popFromResultMap` helpers,
- the `NfFileWatcher` contract and the `createNfWatcher` / `syncNfFileWatcher` implementations, plus `linkedSharedDirs` / `sharedMappingDirs` for deciding what to watch (since v4.4),
- the `writeImportMap`, `prepareSkipList` and `isInSkipList` helpers used by the build pipeline,
- `densifyExternals` / `toDenseSharedInfoFormat` for producing the [dense externals](artifacts.md#dense-externals) shape.

> **Note:** `getChecksum` gained three optional parameters in v4.4 — the feature flags, per-package content signals and installed versions that now take part in the [cache key](caching.md#the-checksum). Existing calls keep working; a caller that omits them reproduces the old key.

## `@softarc/native-federation/internal/browser`

Since v4.4, the browser-safe subset of `/internal` — the exports that carry no Node dependencies, so a runtime or a browser-side tool can import them without pulling in `fs` and `path`. It covers the error types, `densifyExternals` / `toDenseSharedInfoFormat`, `prepareSkipList` / `isInSkipList` and the config contract types.

Everything here is also re-exported from `/internal`, so a build-time consumer only needs the one import.

> **Note:** Application developers almost never import from this package directly. Consume an [adapter](../adapters/index.md) instead.
