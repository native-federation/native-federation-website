---
applies_to: [v3, v4]
---

# API Reference

> The public API surface of @softarc/native-federation-runtime — initFederation, loadRemoteModule, registry helpers and type exports.

`@softarc/native-federation-runtime` exposes a small set of functions and types. Most applications only use `initFederation` and `loadRemoteModule`; the lower-level helpers are useful when integrating with custom bootstrap flows, test setups or adapter code.

## Functions

| Export | Kind | Summary |
| --- | --- | --- |
| `initFederation(remotesOrManifestUrl?, options?)` | function | Main host-side entry point. Loads the host's `remoteEntry.json`, fetches every remote's `remoteEntry.json`, builds and injects the import map. Returns the final `ImportMap`. See [`initFederation`](init-federation.md). |
| `loadRemoteModule(remoteName, exposedModule)` / `loadRemoteModule(options)` | function | Dynamically imports an exposed module from a registered remote. Supports lazy registration via `options.remoteEntry` and a `fallback` for graceful degradation. See [`loadRemoteModule`](load-remote-module.md). |
| `fetchAndRegisterRemotes(remotes, options?)` | function | Fetches and registers a batch of remotes in parallel. Honours `throwIfRemoteNotFound` and `cacheTag`. Returns a merged `ImportMap`. Called internally by `initFederation`. |
| `fetchAndRegisterRemote(federationInfoUrl, remoteName?)` | function | Fetches and registers a single remote. Computes the remote's import map and, if the `remoteEntry.json` includes a `buildNotificationsEndpoint`, starts watching for rebuild events. |
| `processRemoteInfos(remotes, options?)` | function (deprecated) | Legacy alias for `fetchAndRegisterRemotes`. Kept for backwards compatibility with v3 call sites. |
| `processHostInfo(hostInfo, relBundlesPath?)` | function | Builds the host's contribution to the import map from a `FederationInfo`. Useful in SSR flows that prefer to load the host's info themselves. `relBundlesPath` defaults to `'./'`. |
| `mergeImportMaps(a, b)` | function | Shallow-merges two `ImportMap` values. Second argument wins on key collisions. |

## Types

| Export | Kind | Summary |
| --- | --- | --- |
| `InitFederationOptions` | interface | `{ cacheTag?: string }` — options accepted by `initFederation`. `cacheTag` is appended as `?t=<cacheTag>` to every metadata request. |
| `ProcessRemoteInfoOptions` | interface | Extends `InitFederationOptions` with `throwIfRemoteNotFound: boolean`. Drives the strict/forgiving error behaviour in `fetchAndRegisterRemotes`. |
| `LoadRemoteModuleOptions<T>` | interface | Long-form options for `loadRemoteModule`: `remoteEntry?`, `remoteName?`, `exposedModule`, `fallback?`. |
| `ImportMap` | interface | The browser import-map shape: `{ imports: Imports; scopes: Scopes }`. |
| `Imports` | alias | `Record<string, string>` — bare-specifier to URL. |
| `Scopes` | alias | `Record<string, Imports>` — scope URL prefix to scoped imports. |

## Constants

| Export | Kind | Summary |
| --- | --- | --- |
| `BUILD_NOTIFICATIONS_ENDPOINT` | const | `'/@angular-architects/native-federation:build-notifications'`. The SSE path the Angular dev server exposes for `federation-rebuild-complete` events. Mostly of interest to adapter authors. |

## Global state

The runtime stores its registries on `globalThis.__NATIVE_FEDERATION__`:

```ts
type NfCache = {
  externals:             Map<string, string>;  // "pkg@version" -> URL
  remoteNamesToRemote:   Map<string, Remote>;   // remoteName    -> info + baseUrl
  baseUrlToRemoteNames:  Map<string, string>;   // baseUrl       -> remoteName
};
```

These are not exported directly, but the object exists for tooling interop — in particular for `@angular-architects/module-federation`'s shared-scope helpers to enumerate externals when mixing classic Module Federation and Native Federation remotes on the same page.

## Source & versioning

The classic runtime's public surface has not changed in shape since the Native Federation 2.x line — v3 simply stabilized it, and v4 ships it unchanged for backwards compatibility while promoting the [Orchestrator](../orchestrator/index.md) as the recommended runtime. The package is distributed as ESM only (`"type": "module"`), matching Native Federation 4's ESM-first posture.
