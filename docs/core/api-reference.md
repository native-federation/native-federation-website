---
applies_to: [v4]
---

# API Reference

> The public API surface of @softarc/native-federation — exports from the main, /config and /domain entry points.

`@softarc/native-federation` exposes three import subpaths. The default entry covers the build-time API; `/config` is the configuration DSL; `/domain` re-exports the TypeScript contracts so adapter authors can type against them.

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
| `shareAll(options, opts?)` | function | Share every dependency found in `package.json`. Accepts `overrides` for per-package deviation. |
| `share(entries, projectPath?, skipList?)` | function | Share a hand-picked set of packages with per-entry options. |
| `findRootTsConfigJson()` | function | Locate the root `tsconfig.base.json` or `tsconfig.json` for mapped-path resolution. |
| `DEFAULT_SKIP_LIST` | const | The baseline skip list `withNativeFederation` merges with your `skip`. |

## `@softarc/native-federation/domain`

TypeScript contracts — types only. Useful when authoring an adapter or integrating at the type level.

- `FederationConfig`, `NormalizedFederationConfig`
- `ExternalConfig`, `NormalizedExternalConfig`, `SharedExternalsConfig`, `ShareExternalsOptions`, `IncludeSecondariesOptions`
- `FederationOptions`, `NormalizedFederationOptions`
- `NFBuildAdapter`, `NFBuildAdapterOptions`, `NFBuildAdapterContext`, `NFBuildAdapterResult`, `EntryPoint`
- `FederationInfo`, `SharedInfo`, `ExposesInfo`, `ChunkInfo`, `ArtifactInfo`
- `FederationCache`
- `SkipList`, `PreparedSkipList`
- `BuildNotificationOptions`

## `@softarc/native-federation/internal`

Utility exports intended for adapter authors — error types, the checksum helper, the logger, a rebuild queue, the file-watcher contract, and the cache-path helper. Treated as semi-public; breaking changes are possible across minor versions.

> **Note:** Application developers almost never import from this package directly. Consume an [adapter](../adapters/index.md) instead.
