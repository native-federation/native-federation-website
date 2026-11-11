# API Reference

> The public API surface of @softarc/native-federation — exports from the main, /config and /domain entry points.

`@softarc/native-federation` exposes several import subpaths. The default entry covers the build-time API; `/config` is the configuration DSL; `/domain` re-exports the TypeScript contracts so adapter authors can type against them; `/internal` and `/internal/browser` hold semi-public utilities for adapter authors.

## `@softarc/native-federation`

Build-time API — everything you need to drive a federation build.

| Export | Kind | Summary |
| --- | --- | --- |
| `federationBuilder` | object | High-level builder with `init`, `build`, `close` and the `externals` / `config` / `federationInfo` / `outputFiles` / `adapterData` accessors. See [Build Process](build-process.md). |
| `setBuildAdapter(adapter)` | function | Register a bundler adapter imperatively. `federationBuilder.init` calls this for you. |
| `buildForFederation(config, options, externals, signal?)` | function | Full build — bundles shared externals, mapped paths and exposed modules, then writes `remoteEntry.json` and the import map. |
| `rebuildForFederation(config, options, externals, modifiedFiles, signal?)` | function | Incremental rebuild. `federationBuilder.build` dispatches to this after the first full build. |
| `bundleExposedAndMappings(config, options, externals, ...)` | function | Deprecated — a step of `buildForFederation` / `rebuildForFederation`. Bundles just the exposed modules and shared mapped paths. |
| `createFederationCache(cachePath, bundlerCache?)` | function | Construct a `FederationCache` — use this to share cache state across multiple builds. |
| `getExternals(config)` | function | Derive the list of externals (package names) from a normalized config. |
| `normalizeFederationOptions(options, cache?, fromAdapter?)` | function | Load and normalize the federation config and options, returning both. The low-level entry the `federationBuilder` calls internally. `fromAdapter.externals` merges an adapter's own [externals](../adapters/build-your-own.md#1-the-contract) into `config.externals`. |
| `writeFederationInfo(info, options)` | function | Deprecated — `buildForFederation` writes `remoteEntry.json`. Write a `FederationInfo` object to `remoteEntry.json`. |
| `BuildHelperParams` | type | Argument type for `federationBuilder.init`. |

## `@softarc/native-federation/config`

Configuration DSL used inside `federation.config.js`.

| Export | Kind | Summary |
| --- | --- | --- |
| `withNativeFederation(config)` | function | Normalize a user-supplied `FederationConfig` — applies defaults, prepares the skip list, resolves mapped paths. |
| `fromPackageJson(baseCfg, projectPath?)` | function | Recommended dep-sharing builder. Shares all `package.json` deps and returns a fluent builder (`.only` / `.skip` / `.override` / `.patch`) that `shared` accepts as is. `.filter` is an alias of `.only`; `.get` is deprecated. |
| `shareAll(options, opts?)` | function | Share every dependency found in `package.json`. Accepts `overrides` for per-package deviation. |
| `share(entries, projectPath?, skipList?)` | function | Deprecated — use `fromPackageJson().only([...]).override({...})`. Share a hand-picked set of packages with per-entry options. |
| `mappingsFromWorkspace(baseCfg?)` | function | Builder for `sharedMappings` — `.only()` (or its alias `.filter()`) narrows the selection, `.patch()` annotates a subset, `.package()` declares a package boundary, `.get()` returns the entry array (optional). See [sharedMappings](configuration.md#mappingsfromworkspace). |
| `setInferVersion(fn)` | function | Deprecated — set `requiredVersion: 'auto'` on the shared entry. Override how shared-dependency versions are inferred for `requiredVersion: 'auto'`. |
| `findRootTsConfigJson()` | function | Deprecated — core resolves the tsconfig itself. Locate the root `tsconfig.base.json` or `tsconfig.json` — the fallback for mapped-path resolution when no build `tsConfig` is given. |
| `DEFAULT_SKIP_LIST` | const | The baseline skip list `withNativeFederation` merges with your `skip`. |

## `@softarc/native-federation/domain`

TypeScript contracts — types only. Useful when authoring an adapter or integrating at the type level.

- `FederationConfig`, `SharedMappingEntry`, `SharedMappingPackageEntry`, `MappingConfigInput` — the config a shared mapping takes
- `ConfigBuilder`, `PackageJsonExternalsBuilder`, `WorkspaceMappingsBuilder` — the builder types `fromPackageJson` and `mappingsFromWorkspace` return. `shared` and `sharedMappings` accept any `ConfigBuilder` in place of its value
- `ExternalConfig`, `SharedExternalsConfig`, `ShareExternalsOptions`, `ShareAllExternalsOptions`, `IncludeSecondariesOptions` — the two `Share*Options` input types accept the [object form of `requiredVersion`](sharing.md#choosing-the-emitted-range)
- `FederationOptions`, `NormalizedFederationOptions`
- `NFBuildAdapter`, `NFBuildAdapterOptions`, `NFBuildAdapterResult`, `NFBundleKind`, `NFAdapterInput`, `EntryPoint`, `ExternalsCacheKey`
- `FederationInfo`, `SharedInfo`, `ExposesInfo`, `ChunkInfo`, `ChunkMap`, `IntegrityMap`, `OutputFile` — `ChunkMap` is the shape of an exposed module's [`chunks`](artifacts.md#exposed-module-chunks)
- Deprecated: `NFBuildAdapterContext` (core never reads it), `ArtifactInfo` (only `bundleExposedAndMappings` returns it) and `FederationManifest` (the orchestrator has its own type)
- `FederationCache`
- `SkipList`, `SkipListEntry`, `SkipFn`, `PreparedSkipList`
- `BuildNotificationOptions`, `BuildNotificationType`

## `@softarc/native-federation/internal`

Utility exports intended for adapter authors. Treated as semi-public; breaking changes are possible across minor versions, so pin core to a minor (`~`) when you import from it. Includes:

- `AbortedError`,
- `getChecksum` / `getDefaultCachePath` cache helpers, and the deprecated `hashFile`,
- `toDiskCase(path)`, which returns a path in the casing it has on disk,
- `collectOutputFiles(federationCache)`, the list behind `federationBuilder.outputFiles`,
- `matchesExternal`, the rule core reads `external` by — for a bundler whose own externals matching differs,
- the `logger` and `setLogLevel`,
- the `RebuildQueue`,
- the `NfFileWatcher` contract and the `createNfWatcher` / `syncNfFileWatcher` implementations, plus `linkedSharedDirs` / `sharedMappingDirs` for deciding what to watch. `createNfWatcher` also takes a `watch` option — the `WatchPort['watch']` signature, exported alongside `WatchPort` / `WatchHandle` — so a host that already ships a watcher can hand its own in,
- `createMappingImportResolver` and its `MappingImportResolver` type — see the note below,
- the `prepareSkipList` and `isInSkipList` helpers, so an adapter can test its skip list with core's matcher, and the deprecated `writeImportMap`,
- `densifyExternals` / `toDenseSharedInfoFormat` for producing the [dense externals](artifacts.md#dense-externals) shape.

> **Note:** `createMappingImportResolver(sharedMappings)` answers one question for an adapter's bundler hook: a relative import that lands inside a shared-mapped library — `../../libs/ui/src/button` rather than `@my-org/ui` — would bundle that file into the consumer next to the shared copy. The resolver returns the specifier to rewrite the import onto, or `null` to leave it alone. Hand it the `sharedMappings` that `normalizeFederationOptions` leaves on the config: those are expanded and pruned, which is what keeps a rewrite off a specifier that was never published. A rewrite happens only where every binding the target exports arrives under the same name through the mapping's entry point; where that entry point is readable and omits them, the build warns instead, naming the file and the symbols to re-export. Paths are compared after resolving symlinks, so an import reported through a linked directory still matches its mapping. Call `reset()` when a build starts — a plugin outlives a rebuild, and the TypeScript program and directory lookups the resolver keeps would go stale.

> **Note:** Beyond the packages, `getChecksum` takes the optional inputs that take part in the [cache key](caching.md#the-checksum): the dev flag, the builder version, the feature flags, per-package content signals, installed versions and the adapter's `ExternalsCacheKey`.

## `@softarc/native-federation/internal/browser`

The browser-safe subset of `/internal` — the exports that carry no Node dependencies, so a runtime or a browser-side tool can import them without pulling in `fs` and `path`. It covers `AbortedError`, `densifyExternals` / `toDenseSharedInfoFormat`, `prepareSkipList` / `isInSkipList` and the config contract types.

Everything here is also re-exported from `/internal`, so a build-time consumer only needs the one import.

> **Note:** Application developers almost never import from this package directly. Consume an [adapter](../adapters/index.md) instead.
