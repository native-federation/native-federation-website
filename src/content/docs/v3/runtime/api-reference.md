# API Reference

> The public API surface of @softarc/native-federation-runtime v3 — initFederation, loadRemoteModule, the lower-level building blocks, the Module Federation bridge and type exports.

`@softarc/native-federation-runtime` exposes a small set of functions and types. Most applications only use `initFederation` and `loadRemoteModule`; the lower-level helpers are useful when integrating with custom bootstrap flows, test setups or adapter code.

Everything below is reachable from the package root. The package has a single entry point — there are no subpath exports.

## Functions

| Export | Kind | Summary |
| --- | --- | --- |
| `initFederation(remotesOrManifestUrl?, options?)` | function | Main host-side entry point. Loads the host's `remoteEntry.json`, fetches every remote's `remoteEntry.json`, builds and injects the import map. Returns the final `ImportMap`. See [`initFederation`](init-federation.md). |
| `loadRemoteModule(remoteName, exposedModule)` / `loadRemoteModule(options)` | function | Dynamically imports an exposed module from a registered remote. Supports lazy registration via `options.remoteEntry` and a `fallback` for graceful degradation. See [`loadRemoteModule`](load-remote-module.md). |
| `processRemoteInfos(remotes, options?)` | function | Fetches and registers a batch of remotes in parallel and merges their import maps. Honours `throwIfRemoteNotFound` and `cacheTag`. Returns the merged `ImportMap` — it does not inject anything. Called internally by `initFederation`. |
| `fetchAndRegisterRemote(federationInfoUrl, remoteName?)` | function | Fetches and registers a single remote. Computes the remote's import map and, if the `remoteEntry.json` includes a `buildNotificationsEndpoint`, starts watching for rebuild events. Falls back to the `name` in `remoteEntry.json` when `remoteName` is omitted. |
| `processHostInfo(hostInfo, relBundlesPath?)` | function | Builds the host's contribution to the import map from a `FederationInfo` and registers its shared deps as externals. Useful in flows that load the host's info themselves. `relBundlesPath` defaults to `'./'`. |
| `mergeImportMaps(a, b)` | function | Shallow-merges two `ImportMap` values. Second argument wins on key collisions. |
| `getShared(options?)` | function | Converts the externals registry into the `shared` shape webpack Module Federation expects, so both systems resolve to one instance per package. Options: `{ singleton: boolean; requiredVersionPrefix: '^' \| '~' \| '>' \| '>=' \| '' }` — both default to a non-singleton, exact-version config. |

## Types

| Export | Kind | Summary |
| --- | --- | --- |
| `InitFederationOptions` | interface | `{ cacheTag?: string; deployUrl?: string }` — options accepted by `initFederation`. See [`deployUrl`](init-federation.md#deploy-url) and [`cacheTag`](init-federation.md#cache-tag). |
| `ProcessRemoteInfoOptions` | interface | Extends `InitFederationOptions` with `throwIfRemoteNotFound: boolean`. Drives the strict/forgiving error behaviour in `processRemoteInfos`. |
| `LoadRemoteModuleOptions<T>` | type | Long-form options for `loadRemoteModule`: `remoteEntry?`, `remoteName?`, `exposedModule`, `fallback?`. |
| `FederationInfo` | interface | The parsed `remoteEntry.json`: `{ name, exposes, shared, buildNotificationsEndpoint? }`. |
| `ExposesInfo` | interface | One entry of `exposes`: `{ key, outFileName, dev? }`. |
| `SharedInfo` | type | One entry of `shared`: `{ singleton, strictVersion, requiredVersion, version?, packageName, outFileName, dev? }`. |
| `ImportMap` | type | The browser import-map shape: `{ imports: Imports; scopes: Scopes }`. |
| `Imports` | alias | `Record<string, string>` — bare-specifier to URL. |
| `Scopes` | alias | `Record<string, Imports>` — scope URL prefix to scoped imports. |
| `ShareObject` / `ShareConfig` / `ShareOptions` | types | The Module Federation shapes produced and consumed by `getShared`. |

## Constants

| Export | Kind | Summary |
| --- | --- | --- |
| `BUILD_NOTIFICATIONS_ENDPOINT` | const | `'/@angular-architects/native-federation:build-notifications'`. The SSE path the Angular dev server exposes for rebuild events. |
| `BuildNotificationType` | enum | `COMPLETED` (`'federation-rebuild-complete'`), `ERROR`, `CANCELLED`. Only `COMPLETED` triggers a page reload. |
| `BuildNotificationOptions` | interface | `{ enable: boolean; endpoint: string }` — the builder-side shape mirrored here so adapters can share the type. |

## Global state

The runtime stores its registries on `globalThis.__NATIVE_FEDERATION__`:

```ts
type NfCache = {
  externals:             Map<string, string>;  // "pkg@version" -> URL
  remoteNamesToRemote:   Map<string, Remote>;   // remoteName    -> info + baseUrl
  baseUrlToRemoteNames:  Map<string, string>;   // baseUrl       -> remoteName
};
```

The object is created on first import and reused afterwards, so a second copy of the runtime on the same page shares the same registries. The helpers that read and write it (`addRemote`, `getRemote`, `hasRemote`, `getRemoteNameByBaseUrl`, `isRemoteInitialized`, `getExternalUrl`, `setExternalUrl`) are internal — they are not re-exported from the package root. Reach for the global object directly if you need to inspect state, as `getShared` does.

## Mixing with webpack Module Federation

`getShared` exists for pages that run both Native Federation and classic Module Federation remotes. It walks the externals registry, splits each `pkg@version` key, and emits an MF `shared` entry whose `get()` loads the already-resolved URL through `importShim`:

```ts
import { getShared } from '@softarc/native-federation-runtime';

const shared = getShared({ singleton: true, requiredVersionPrefix: '^' });
```

Keys starting with `/@id/` or `@angular-architects/module-federation`, and keys with an empty version, are filtered out. Hand the result to your MF runtime as its shared scope so both systems agree on one instance per package.
