---
applies_to: [v3, v4]
---

# Configuration

> Every option you can pass to initFederation — host entry, import-map implementation, logging, resolution modes and storage.

Everything you pass as the second argument to `initFederation` lives on this page. Options are grouped into five concerns — host entry, import-map implementation, logging, modes, and storage — and every option ships with a sensible default, so a bare `initFederation(manifest)` is already a valid call.

- [1. Host configuration](#host)
- [2. Import-map implementation](#import-map)
- [3. Logging](#logging)
- [4. Modes — strictness & resolution profile](#modes)
- [5. Storage](#storage)

## 1. Host configuration

A **host remote entry** is a `remoteEntry.json` published by the host itself. Whenever an external appears both in the host entry and in a regular remote, the host version wins — making this the right escape hatch for locking a framework or design-system version globally.

```ts
type HostOptions = {
  hostRemoteEntry?: string | false | {
    name?: string;
    url: string;
    cacheTag?: string;
  };
};
```

| Option | Default | Description |
| --- | --- | --- |
| `hostRemoteEntry` | `false` | Adds a host `remoteEntry.json` that takes precedence during shared-version resolution. Can be a URL, the full object form, or `false` to disable. |
| `hostRemoteEntry.cacheTag` | _none_ | Opaque string appended as a query parameter — the orchestrator treats a new `cacheTag` as a different file and refetches. Use this to bust caches after a host redeploy. |

### Example

```ts
import { initFederation } from '@softarc/native-federation-orchestrator';

initFederation('http://example.org/manifest.json', {
  hostRemoteEntry: { url: './remoteEntry.json', cacheTag: 'v1.2.3' },
});
```

## 2. Import-map implementation

The orchestrator commits a standard [import map](https://caniuse.com/import-maps) to the DOM and uses the browser's own `import()` to load modules. For older browsers — or whenever you need [dynamic init](version-resolver.md#dynamic-init) — swap in [es-module-shims](https://www.npmjs.com/package/es-module-shims).

```ts
type ImportMapOptions = {
  loadModuleFn?:   (url: string) => Promise<unknown>;
  setImportMapFn?: (importMap: ImportMap, opts?: { override?: boolean }) => Promise<ImportMap>;
  reloadBrowserFn?: () => void;
};
```

| Option | Default | Description |
| --- | --- | --- |
| `setImportMapFn` | `replaceInDOM('importmap')` | How to commit an import map — by default, replaces any existing `<script type="importmap">` in the DOM. |
| `loadModuleFn` | `url => import(url)` | How a module is actually imported. Override when you need the shim loader or custom instrumentation. |
| `reloadBrowserFn` | `() => window.location.reload()` | Called when the SSE dev feature detects a rebuilt remote. Override for custom reload UX. |

### Two ready-made presets

```ts
import 'es-module-shims';
import { initFederation } from '@softarc/native-federation-orchestrator';
import {
  useShimImportMap,
  useDefaultImportMap,
  replaceInDOM,
} from '@softarc/native-federation-orchestrator/options';

initFederation('http://example.org/manifest.json', {
  // Option 1 — native import maps (default)
  ...useDefaultImportMap(),

  // Option 2 — es-module-shims
  ...useShimImportMap({ shimMode: true }),

  // Option 3 — custom
  loadModuleFn: (url) => customImport(url),
  setImportMapFn: replaceInDOM('importmap'),
});
```

> **Note:** `useShimImportMap` is required for dynamic init — native import maps can be committed to the DOM only once, while es-module-shims accepts additional maps at runtime.

## 3. Logging

Diagnostics for both development and production. Ships with two built-in loggers and accepts any object that matches the `Logger` interface.

```ts
type LoggingOptions = {
  logger?:   Logger;
  logLevel?: 'debug' | 'warn' | 'error';
  sse?:      boolean;
};

interface Logger {
  debug(step: number, msg: string, details?: unknown): void;
  warn (step: number, msg: string, details?: unknown): void;
  error(step: number, msg: string, details?: unknown): void;
}
```

| Option | Default | Description |
| --- | --- | --- |
| `logger` | `noopLogger` | Where logs go. Use `consoleLogger` during development, or provide your own for Sentry / Bugsnag / etc. |
| `logLevel` | `'error'` | Level threshold. `'warn'` emits warn+error; `'debug'` emits everything. |
| `sse` | `false` | Dev feature — listens to server-sent rebuild events from remotes and triggers `reloadBrowserFn`. |

### Example

```ts
import { initFederation } from '@softarc/native-federation-orchestrator';
import { noopLogger, consoleLogger } from '@softarc/native-federation-orchestrator/options';

initFederation('http://example.org/manifest.json', {
  logLevel: 'debug',
  logger: consoleLogger,     // or noopLogger, or a custom Logger
});
```

## 4. Modes — strictness & resolution profile

Mode options are the hyperparameters for the [Version Resolver](version-resolver.md): how strict to be when something unexpected happens, and how aggressively to reuse cached state.

```ts
type ModeOptions = {
  strict?: boolean | {
    strictRemoteEntry?: boolean;
    strictExternalCompatibility?: boolean;
    strictExternalSameVersionCompatibility?: boolean;
    strictExternalVersion?: boolean;
    strictImportMap?: boolean;
  };
  profile?: {
    latestSharedExternal?: boolean;
    overrideCachedRemotes?: 'always' | 'never' | 'init-only';
    overrideCachedRemotesIfURLMatches?: boolean;
  };
};
```

### Strictness

All flags default to `false`, which means "log and continue". Setting `strict: true` turns them all on at once.

| Option | Effect |
| --- | --- |
| `strict` | Shortcut — sets every specific strict flag below to `true`. |
| `strict.strictRemoteEntry` | Throws on malformed `remoteEntry.json`. When `false`, the broken remote is skipped and initialization continues. |
| `strict.strictExternalCompatibility` | Throws when two shared externals have incompatible version ranges. When `false`, the incompatible version is demoted to a scoped external with a warning. |
| `strict.strictExternalSameVersionCompatibility` | Niche edge case — throws when an already-cached shared version is re-submitted with a different `requiredVersion` range. Otherwise, the cached entry is preserved. |
| `strict.strictExternalVersion` | Throws if a shared external's `version` is missing or not valid semver. When `false`, the first entry matching `requiredVersion` is picked. |
| `strict.strictImportMap` | Throws when the import-map builder encounters corrupt cache state. |

### Resolution profile

The profile controls _how_ the resolver picks winners and _whether_ it refreshes cached remotes.

| Option | Default | Description |
| --- | --- | --- |
| `profile.latestSharedExternal` | `false` | When `true`, always pick the highest version in the scope. When `false` (default), pick the version that minimizes extra scoped downloads. |
| `profile.overrideCachedRemotes` | `'init-only'` | When to refetch a remote that already lives in cache — see below. |
| `profile.overrideCachedRemotesIfURLMatches` | `false` | By default, a cached remote is only overridden when its URL changed. Set this to `true` to force refetch even when the URL is identical. |

`overrideCachedRemotes` values:

- `'never'` — don't touch cached remotes, ever. Strongest cache, slowest pickup of new versions.
- `'init-only'` (default) — allow overrides during `initFederation`, skip during dynamic init. Good compromise.
- `'always'` — always check and possibly refetch. Use when cache freshness matters more than bandwidth.

### Two ready-made profiles

```ts
import { initFederation } from '@softarc/native-federation-orchestrator';
import { defaultProfile, cachingProfile } from '@softarc/native-federation-orchestrator/options';

// defaultProfile
// { latestSharedExternal: false, overrideCachedRemotes: 'init-only', overrideCachedRemotesIfURLMatches: false }

// cachingProfile
// { latestSharedExternal: false, overrideCachedRemotes: 'never',     overrideCachedRemotesIfURLMatches: false }

initFederation('http://example.org/manifest.json', {
  strict: true,
  profile: cachingProfile,
});
```

> **Note:** The caching profile is tempting but comes with a trade-off: newly deployed remote versions won't be picked up until the cache is explicitly cleared. Pair it with `clearStorage: true` on cache-busting events, or stick with `defaultProfile` when remotes change frequently.

## 5. Storage

The orchestrator keeps its internal caches (remote info, shared externals, scoped externals) inside a **storage entry**. The default is an in-memory map on `globalThis`, but any `Storage`-compatible backend works.

```ts
type StorageOptions = {
  storage?:          StorageEntryCreator;
  clearStorage?:     boolean;
  storageNamespace?: string;
};
```

| Option | Default | Description |
| --- | --- | --- |
| `storage` | `globalThisStorageEntry` | How the cache is persisted. Built-ins: `globalThisStorageEntry`, `sessionStorageEntry`, `localStorageEntry`. Custom implementations are supported. |
| `clearStorage` | `false` | When `true`, `initFederation` wipes the namespace before initializing — handy for one-shot cache busts after a deploy. |
| `storageNamespace` | `'__NATIVE_FEDERATION__'` | Namespace prefix for stored keys (e.g. `__NATIVE_FEDERATION__.remotes`). Change it to run multiple orchestrators on the same origin. |

### Example

```ts
import { initFederation } from '@softarc/native-federation-orchestrator';
import {
  globalThisStorageEntry,
  localStorageEntry,
  sessionStorageEntry,
} from '@softarc/native-federation-orchestrator/options';

initFederation('http://example.org/manifest.json', {
  clearStorage: true,
  storageNamespace: '__custom_namespace__',

  // Option 1 — in-memory (default)
  storage: globalThisStorageEntry,

  // Option 2 — persisted for the browser session
  storage: sessionStorageEntry,

  // Option 3 — persisted across browser restarts
  storage: localStorageEntry,
});
```

> **Note:** Most server-rendered hosts want `sessionStorageEntry`: it survives navigation-triggered full reloads (the whole point of caching here) but is automatically cleared when the tab closes, so a stale resolution can never live longer than the user's session.

## Putting it together

```ts
import { initFederation } from '@softarc/native-federation-orchestrator';
import {
  consoleLogger,
  sessionStorageEntry,
  useShimImportMap,
  cachingProfile,
} from '@softarc/native-federation-orchestrator/options';

const { loadRemoteModule } = await initFederation(manifest, {
  // Host
  hostRemoteEntry: { url: './host-remoteEntry.json', cacheTag: '2025-04-22' },

  // Import map
  ...useShimImportMap({ shimMode: true }),

  // Logging
  logLevel: 'warn',
  logger: consoleLogger,

  // Modes
  strict: { strictRemoteEntry: true, strictExternalCompatibility: true },
  profile: cachingProfile,

  // Storage
  storage: sessionStorageEntry,
  storageNamespace: '__NATIVE_FEDERATION__',
  clearStorage: false,
});
```

## See also

- [The orchestrator docs](https://github.com/native-federation/orchestrator/blob/main/docs/config.md) — Which shows a bit more in-depth how the orchestrator can be configured.
- [Version Resolver](version-resolver.md) — how the profile and strictness flags actually shape resolution output.
- [Architecture — caches](architecture.md#caches) — what lives in the storage namespace.
- [Getting Started](getting-started.md) — worked examples for the quickstart, registry and custom setups.
