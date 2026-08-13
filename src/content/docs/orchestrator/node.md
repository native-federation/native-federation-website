---
applies_to: [v4]
---

# Node.js / SSR

> Run the orchestrator's full pipeline server-side. `@softarc/native-federation-orchestrator/node` is a drop-in Node entry that resolves federated modules through `module.register()` instead of an HTML `<script type="importmap">` tag.

The `/node` subpath gives you the same orchestrator runtime — version resolver, SRI verification, shared-scope handling, dynamic-init flow — running in a Node process. Use it for SSR, edge rendering, integration tests, server-side prerendering, or any other long-lived Node runtime that needs to import federated modules.

It supersedes the deprecated [`@softarc/native-federation-node`](https://www.npmjs.com/package/@softarc/native-federation-node) package: the orchestrator's version resolver, integrity verification, shared-scope handling, and dynamic remote initialization (`initRemoteEntry`) are now all available on the server side. See [Migrating from `@softarc/native-federation-node`](#migrating) below.

## Prerequisites

- **Node.js ≥ 20.6.0.** That is the floor for stable [`module.register()`](https://nodejs.org/api/module.html#moduleregisterspecifier-parenturl-options), which the loader uses. The package declares this in `engines.node`.
- The host application is run as an ES module (`"type": "module"` in your `package.json` or a `.mjs` entry file).
- One or more remotes that publish a `remoteEntry.json` — either reachable over http(s) or available on the local filesystem.

## Quick start

```js
import { initNodeFederation } from '@softarc/native-federation-orchestrator/node';

await initNodeFederation('./dist/browser/federation.manifest.json', {
  hostRemoteEntry: './dist/browser/remoteEntry.json',
});

// All subsequent imports go through the federation import map.
await import('./server.mjs');
```

That's the whole integration. The first call:

1. Loads the manifest (from disk, http, or an inline object).
2. Loads each remote's `remoteEntry.json` (from disk or http).
3. Builds a W3C-spec import map exactly as the browser orchestrator does — running the same version resolver, integrity checks, and shared-scope logic.
4. Installs a Node loader hook (`module.register`) and hands it the resolved import map over a `MessageChannel`.
5. Resolves once the loader has acknowledged the map (10-second acknowledgement timeout, after which the call rejects).

After that, any bare specifier matching the import map — whether produced by `loadRemoteModule(...)` or written directly as `import 'team/remote-a/./Hello'` — is rewritten by the loader and fetched from disk or over http as needed.

## Manifest and remote sources

Both the manifest and individual `remoteEntry.json` URLs can be:

- A plain http(s) URL — fetched via the global `fetch`.
- A `file://` URL — read via `fs/promises`.
- A bare filesystem path (absolute or relative to `process.cwd()`) — read via `fs/promises`. The orchestrator converts bare paths to `file://` URLs via `pathToFileURL` before handing them to the resolver.

You can also pass the manifest as a JavaScript object to skip the load step entirely:

```js
await initNodeFederation(
  {
    'team/remote-a': 'https://cdn.example.com/remote-a/remoteEntry.json',
    'team/remote-b': './dist/browser/remote-b/remoteEntry.json',
  },
  {
    hostRemoteEntry: 'file:///app/dist/browser/remoteEntry.json',
  }
);
```

Each manifest entry can also be pinned against an SRI hash for integrity, the same way as in the browser:

```js
await initNodeFederation(
  {
    'team/remote-a': {
      url: 'https://cdn.example.com/remote-a/remoteEntry.json',
      integrity: 'sha384-…',
    },
  },
  {
    hostRemoteEntry: {
      url: './dist/browser/remoteEntry.json',
      integrity: 'sha384-…',
    },
    manifestIntegrity: 'sha384-…',
  }
);
```

See [Security — Subresource Integrity](security.md#subresource-integrity) for the full picture.

## API

```ts
import {
  initNodeFederation,
  type InitNodeFederationOptions,
} from '@softarc/native-federation-orchestrator/node';
import type {
  NativeFederationResult,
  FederationManifest,
} from '@softarc/native-federation-orchestrator';

declare function initNodeFederation(
  remotesOrManifestUrl: string | FederationManifest,
  options?: InitNodeFederationOptions
): Promise<NativeFederationResult>;
```

`InitNodeFederationOptions` extends the browser `NFOptions` shape (see the [Configuration Guide](configuration.md) for the full set) with one server-only field:

```ts
export type InitNodeFederationOptions = NFOptions & {
  hostInstances?: HostInstancesOption;
};
```

`hostInstances` bridges the host's shared singletons into the loader so a remote's `import '@angular/core'` resolves to the host's already-loaded instance — see [Bridging host singletons](#host-instances). The Node entry also pre-wires sensible server-side defaults:

| Concern               | Default on Node                                                                       |
| --------------------- | ------------------------------------------------------------------------------------- |
| `setImportMapFn`      | Posts the map to the loader thread over a `MessageChannel` — no DOM mutation.         |
| `loadModuleFn`        | `(url) => import(url)` — Node's native dynamic import.                                |
| `reloadBrowserFn`     | No-op.                                                                                |
| Storage               | In-memory (`globalThisStorageEntry`) — the SSR process is long-lived; no disk needed. |
| SSE (build watching)  | Disabled and stubbed out — HMR is a browser concern.                                  |
| Manifest provider     | fs-aware (`file://` or bare path), falls back to `fetch` for http(s).                 |
| Remote-entry provider | fs-aware, same fallback to `fetch`.                                                   |

Anything in `options` overrides the default. The returned `NativeFederationResult` is identical to the browser one — `loadRemoteModule`, `load`, `initRemoteEntry`, `as<T>()`, `config`, and `adapters`.

## How the loader works

`initNodeFederation` registers a customization hook (an ESM [loader](https://nodejs.org/api/module.html#customization-hooks)) that runs in its own worker thread. The main thread and the loader thread share a `MessageChannel`:

```
┌──────────────────────────┐                     ┌──────────────────────────┐
│  main thread             │   set-import-map    │  loader thread           │
│                          │ ──────────────────▶ │                          │
│  initNodeFederation()    │                     │  resolve / load hooks    │
│  builds the import map   │ ◀────────────────── │  rewrite specifiers      │
│                          │  import-map-applied │                          │
└──────────────────────────┘                     └──────────────────────────┘
```

The loader hosts a W3C-compatible import-map resolve algorithm. For every `import(...)` call from user code, the `resolve` hook:

1. If the specifier is a **bridged host instance** (see [below](#host-instances)), short-circuits it to a synthetic `nf-host:<specifier>` URL — these win over the import map.
2. Otherwise walks `scopes` matching the parent URL and falls back to top-level `imports`, matching by exact specifier first then by trailing-slash prefix.
3. Passes the rewritten URL on to the default resolver.

The `load` hook then handles three cases:

- `nf-host:<spec>` → synthesizes a tiny ES module re-exporting from the host's instance (see [below](#host-instances)).
- `http(s)://…` → short-circuits the default loader and fetches the source over the wire.
- `file://` / `node:` / everything else → falls through normally.

Both the import map and the host-instance set are pushed to the loader thread over the `MessageChannel` (`set-import-map` → `import-map-applied`, `set-host-instances` → `host-instances-applied`). The import map can be updated at any time after the initial install — e.g. when you add a new remote via `initRemoteEntry(...)` — and the loader picks up the new map on the next resolution. Updates are serialized: each post waits for the previous one to be acknowledged before posting.

> **Note:** The acknowledgement round-trip has a 10-second timeout
> (`NODE_LOADER_CLIENT_ACK_TIMEOUT_MS`). If the loader thread fails to ack —
> e.g. because it crashed or was forcibly unregistered — `initNodeFederation`
> rejects with an explicit `node-loader.client` error.

## <a id="host-instances"></a> Bridging host singletons (`hostInstances`)

In the browser, the import map alone guarantees one instance of each shared singleton. On the server that isn't enough: a remote's *secondary* entry point — e.g. `@angular/core/rxjs-interop` — can resolve to a private build-internal chunk instead of the shared `@angular/core`, giving you a **second** core instance and the dreaded `NG0203` ("inject() must be called from an injection context"). `hostInstances` closes that gap by routing the remote's imports to the host's *already-loaded* instances.

Set it in `options.hostInstances`:

| Form | Meaning |
|---|---|
| `'all'` | Every singleton in the host remote entry. Reads `hostRemoteEntry`, takes each shared dep marked `singleton`, and `await import(...)`s it in the orchestrator's realm. Used by the Angular adapter's prod preload. |
| `{ include?, exclude?, load? }` | Same auto-derivation, optionally filtered, with a custom `load`. Dev passes `{ load: (s) => import(s) }` so capture happens through the *host* realm (e.g. Vite's SSR graph), not the orchestrator's. |
| explicit map | A `Record<specifier, namespace>` you supply directly. |

What `initNodeFederation` does when `hostInstances` is set (before the main init flow):

1. `resolveHostInstances(...)` produces a map of `specifier → module namespace` — for `'all'`/auto it imports each singleton; for an explicit map it's used as-is.
2. Those namespaces are published on `globalThis.__NF_HOST_INSTANCES__`.
3. The export *key names* per specifier are pushed to the loader hook via `setHostInstances` (over the same `MessageChannel`, acknowledged with `host-instances-applied`).

From then on the loader bridges any matching import:

```
remote SSR code:  import { inject } from '@angular/core'
        │
        ▼  resolve(): '@angular/core' is a host instance → nf-host:%40angular%2Fcore  (shortCircuit)
        ▼  load():    synthesize  export const inject = globalThis.__NF_HOST_INSTANCES__['@angular/core'].inject
        ▼
   resolves to the host's already-loaded @angular/core  ✔ single instance
```

The synthesized module re-exports every captured key (named exports plus `default`), so a remote's `import '@angular/core'` returns the *same* object the host loaded — one core, no duplication. Failed imports during auto-capture are logged and skipped rather than aborting init.

> **Angular SSR.** You rarely call this directly — the adapter's `node-preload` passes `hostInstances: 'all'` for you. See [Angular Adapter → SSR & Hydration](../angular-adapter/ssr.md). Outside Angular, treat `hostInstances` as an escape hatch for frameworks with the same secondary-entry-point hazard.

## What is *not* on the Node entry

These are deliberately omitted because they make no sense server-side:

- **SSE (`buildNotificationsEndpoint`).** The hook is wired to a no-op; setting `sse: true` on the Node entry has no effect.
- **`localStorageEntry` / `sessionStorageEntry`.** Storage is always in-memory.
- **Trusted Types.** Node has no Trusted Types — the import-map config simply skips that pipeline.
- **`es-module-shims` / `useShimImportMap`.** No need; Node loader hooks resolve everything.

If you pass a custom `setImportMapFn` or `loadModuleFn` you take over from the defaults and the Node loader client will not be exercised.

## <a id="migrating"></a> Migrating from `@softarc/native-federation-node`

The deprecated package can be replaced one-for-one.

```diff
- import { initNodeFederation } from '@softarc/native-federation-node';
+ import { initNodeFederation } from '@softarc/native-federation-orchestrator/node';

  await initNodeFederation({
-   remotesOrManifestUrl: './dist/browser/federation.manifest.json',
-   relBundlePath: '../browser',
+ });
+
+ await initNodeFederation('./dist/browser/federation.manifest.json', {
+   hostRemoteEntry: './dist/browser/remoteEntry.json',
+ });
```

Notable differences:

- The signature is `initNodeFederation(manifest, options)` to match the browser `initFederation`, rather than a single options bag.
- `relBundlePath` is gone. Point `hostRemoteEntry` directly at your host's `remoteEntry.json` (path, `file://`, or http URL).
- The package no longer writes `node.importmap` or `federation-resolver.mjs` to your cwd. Everything is handed to the loader in-memory via `MessageChannel`.
- Version resolution, shared scopes, integrity, and dynamic remote registration now work on the server exactly as they do in the browser — none of these existed in the old package.

The old `nfstart` CLI is not ported. If you previously relied on it, replace it with a three-line entry script — see the [Quick start](#quick-start) above.

## Example: SSR bootstrap

```js
// server.entry.mjs
import { initNodeFederation } from '@softarc/native-federation-orchestrator/node';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BROWSER = resolve(process.cwd(), 'dist/browser');

await initNodeFederation(
  pathToFileURL(resolve(BROWSER, 'federation.manifest.json')).href,
  {
    hostRemoteEntry: pathToFileURL(resolve(BROWSER, 'remoteEntry.json')).href,
    logLevel: 'warn',
  }
);

// Now bring up the actual server — any of its imports that resolve to a
// federated module go through the loader.
await import('./server.mjs');
```

## Example: integration tests

The Node entry is also handy as a way to load federated modules from a test runner without standing up a browser:

```js
import { initNodeFederation } from '@softarc/native-federation-orchestrator/node';

const { loadRemoteModule } = await initNodeFederation(
  { 'team/remote-a': './dist/browser/remote-a/remoteEntry.json' },
  { hostRemoteEntry: './dist/browser/remoteEntry.json' }
);

const { greet } = await loadRemoteModule('team/remote-a', './Hello');
expect(greet('world')).toBe('hello, world!');
```

## See also

- [Angular Adapter — SSR & Hydration](../angular-adapter/ssr.md) — the `node-preload` launch model that wires this entry into an Angular SSR app.
- [The orchestrator node docs](https://github.com/native-federation/orchestrator/blob/main/docs/node.md) — the upstream version of this page.
- [Configuration](configuration.md) — the full `initFederation` options surface; the Node entry accepts the same shape.
- [Security — Subresource Integrity](security.md#subresource-integrity) — pinning manifest, `remoteEntry.json` and modules; works the same way on Node as in the browser.
- [Version Resolver — Dynamic init](version-resolver.md#dynamic-init) — adding remotes at runtime; the Node entry's `initRemoteEntry` follows the same rules.
