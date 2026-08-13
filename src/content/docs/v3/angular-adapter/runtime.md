# Runtime (v3)

> The v3 runtime side of the Angular adapter — a straight re-export of the classic runtime: initFederation, loadRemoteModule, lazy routes and lazy remote registration.

On v3, `@angular-architects/native-federation` adds nothing of its own to the runtime. Its entry point is one line:

```ts
export * from "@softarc/native-federation-runtime";
```

So every runtime symbol you import from the adapter — `initFederation`, `loadRemoteModule`, `fetchAndRegisterRemote`, the `ImportMap` types — _is_ the classic runtime's, unchanged. This page documents that surface as Angular hosts use it.

> **Warning:** `@softarc/native-federation-runtime` has reached **end-of-life** and is no longer maintained. On v4 the adapter bridges to the [orchestrator](../orchestrator/index.md) instead, and its API is deliberately different — see [Runtime (v4)](/docs/v4/angular-adapter/runtime/) and [Migration to v4](/docs/v4/angular-adapter/migration-v4/). This page exists for hosts still on the v3 line.

**On this page**

- [The bootstrap split](#the-bootstrap-split)
- [initFederation](#initfederation)
- [loadRemoteModule](#loadremotemodule)
- [Lazy remote registration](#lazy-remote-registration)
- [The federation manifest](#the-federation-manifest)
- [What v4 changes](#what-v4-changes)

## The Bootstrap Split

Native Federation must wire the import map _before_ Angular evaluates any module that depends on a shared external. The schematic enforces this by splitting `main.ts` in two — the same split v4 uses:

```ts
// projects/<project>/src/main.ts
import { initFederation } from "@angular-architects/native-federation";

initFederation("/assets/federation.manifest.json")
  .catch((err) => console.error(err))
  .then((_) => import("./bootstrap"))
  .catch((err) => console.error(err));
```

```ts
// projects/<project>/src/bootstrap.ts
// ← whatever your original main.ts contained
import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err),
);
```

The dynamic `import('./bootstrap')` is mandatory: it forces the bundler to put your Angular code in a separate chunk that's only loaded once the import map is live.

Your `index.html` also needs [es-module-shims](https://github.com/guybedford/es-module-shims) on the page — the runtime injects its map as `<script type="importmap-shim">`, which browsers ignore on their own. The schematic adds it for you.

## initFederation

```ts
function initFederation(
  remotesOrManifestUrl?: Record<string, string> | string,
  options?: InitFederationOptions,
): Promise<ImportMap>;

interface InitFederationOptions {
  cacheTag?: string;
}
```

Note what it resolves to: the merged **`ImportMap`** that was written to the DOM — _not_ a loader object. On v3 `loadRemoteModule` is a module-level import you call independently; there is nothing to thread through DI. That is the single biggest difference from v4.

- **Host (dynamic).** Pass the manifest URL: `initFederation('/assets/federation.manifest.json')`.
- **Host (static).** Pass the remote map inline: `initFederation({ mfe1: 'http://localhost:4201/remoteEntry.json' })`.
- **Remote.** Pass an empty map: `initFederation({})`. This registers the remote's _own_ shared dependencies at the root of the import map, so its code resolves `@angular/core` and friends to the bundled copies when the remote is served directly.

The remotes-map key is the name you will pass to `loadRemoteModule`. It does **not** have to match the `name` field inside the remote's `remoteEntry.json` — the key you supply here wins.

### Cache busting with `cacheTag`

`cacheTag` is the only option the classic runtime accepts. Set it and the runtime appends `?t=<cacheTag>` (or `&t=…` when the URL already has a query string) to _every_ metadata request — the manifest, the host's `remoteEntry.json`, and each remote's:

```ts
initFederation("/assets/federation.manifest.json", { cacheTag: BUILD_HASH });
```

Use a deployment-stable value — a build hash, a git SHA, a CI run ID. It only affects metadata fetches; module bundles are loaded through the import map and carry their own hashed filenames.

There is no persistent cache, no logger injection and no storage layer. Those arrived with the [orchestrator](../orchestrator/configuration.md).

### Remote load errors

If a single remote fails (network error, 404, invalid JSON), `initFederation` does **not** reject. It logs to `console.error` and continues with the remotes that did load, on the rationale that one flaky remote shouldn't take the host down. For strict behaviour, call `fetchAndRegisterRemotes` yourself:

```ts
import { fetchAndRegisterRemotes } from "@angular-architects/native-federation";

await fetchAndRegisterRemotes(
  { mfe1: "http://localhost:4201/remoteEntry.json" },
  { throwIfRemoteNotFound: true },
);
```

That only covers _remote_ failures. If the **host's** own `remoteEntry.json` cannot be fetched or parsed, `initFederation` rejects with no fallback.

### Hot reload

When a remote's `remoteEntry.json` contains a `buildNotificationsEndpoint`, the runtime opens an `EventSource` on it and calls `window.location.reload()` on `federation-rebuild-complete`. That is how `ng serve` reloads the host after a remote rebuilds. Production builds omit the field, so no connection is opened — nothing to configure on the runtime side.

## loadRemoteModule

```ts
function loadRemoteModule<T = any>(
  remoteName: string,
  exposedModule: string,
): Promise<T>;

function loadRemoteModule<T = any>(
  options: LoadRemoteModuleOptions<T>,
): Promise<T>;

interface LoadRemoteModuleOptions<T = any> {
  remoteEntry?: string; // for lazy registration
  remoteName?: string;
  exposedModule: string;
  fallback?: T;
}
```

Once `initFederation` resolves, lazy-load any exposed module from any registered remote. In an Angular shell that's normal lazy-loading — and because `loadRemoteModule` is a plain import, routes need no wiring:

```ts
// projects/shell/src/app/app.routes.ts
import { Routes } from "@angular/router";
import { loadRemoteModule } from "@angular-architects/native-federation";

export const APP_ROUTES: Routes = [
  {
    path: "flights",
    loadComponent: () =>
      loadRemoteModule("mfe1", "./Component").then((m) => m.AppComponent),
  },
  {
    path: "orders",
    loadChildren: () =>
      loadRemoteModule("mfe2", "./Routes").then((m) => m.ORDERS_ROUTES),
  },
];
```

`remoteName` matches the key from `initFederation`'s remotes map; `exposedModule` matches the key under `exposes` in the remote's `federation.config.js`.

### Fallbacks

`loadRemoteModule` can fail three ways: unknown remote, unknown exposed module, or a failed dynamic import. All three reject by default. Pass a `fallback` and it resolves with that instead, logging the error to `console.error`:

```ts
loadRemoteModule({
  remoteName: "mfe1",
  exposedModule: "./Component",
  // stands in for the module, so give it the module's shape
  fallback: { AppComponent: DefaultComponent },
});
```

Fallbacks suit non-critical widgets — a recommendations panel, an A/B variant — where a missing remote should degrade quietly. For main navigation, let it throw and handle it at the router's error boundary.

## Lazy Remote Registration

To load a remote that was **not** in the `initFederation` manifest, pass its `remoteEntry` URL. The runtime fetches it, registers it, appends its import map to the DOM, then imports the exposed module:

```ts
const mod = await loadRemoteModule({
  remoteEntry: "http://localhost:4203/remoteEntry.json",
  remoteName: "mfe3",
  exposedModule: "./Component",
});
```

This is the v3 answer to plugin-style hosts where the remote list is only known after user interaction. Registration happens once per base URL; later calls reuse the entry. Omit `remoteName` and the runtime derives it from the registry lookup by base URL, falling back to the `name` in the fetched `remoteEntry.json`; if neither resolves it throws `unexpected arguments: Please pass remoteName or remoteEntry`.

On v4 this single call is replaced by the more explicit [`initRemoteEntry`](runtime.md#dynamic-remotes), which also handles semver re-resolution for the late remote's shared dependencies. The v3 form still works on v4, deprecated.

## The Federation Manifest

For dynamic hosts, the manifest is just a JSON object mapping remote name → `remoteEntry.json` URL:

```json
{
  "mfe1": "http://localhost:4201/remoteEntry.json",
  "mfe2": "https://cdn.example.com/orders/remoteEntry.json"
}
```

Swap it per environment by deploying a different `federation.manifest.json` alongside the shell — no rebuild required. URLs may be absolute (production CDN) or relative (local dev, same-origin deploys). This part is unchanged on v4.

## What v4 Changes

| | v3 (this page) | [v4](/docs/v4/angular-adapter/runtime/) |
| --- | --- | --- |
| Adapter runtime export | `export * from '@softarc/native-federation-runtime'` | Own `initFederation` bridging to the orchestrator |
| `initFederation` resolves to | `ImportMap` | `NativeFederationResult` — the loader API |
| `loadRemoteModule` | Module-level import, always available | Taken off the resolved result and threaded through DI; the top-level import is deprecated |
| Options | `cacheTag` only | Full [`NFOptions`](../orchestrator/configuration.md) — logger, storage, modes, SSE, profile |
| Version handling | One URL per scope, no range comparison | [Semver-range resolution](../orchestrator/version-resolver.md) and share scopes |
| Caching between loads | None | Pluggable [storage](../orchestrator/configuration.md#storage) |
| Adding a remote late | `loadRemoteModule({ remoteEntry })` | [`initRemoteEntry`](runtime.md#dynamic-remotes) |

## Related

- [Runtime (v4)](/docs/v4/angular-adapter/runtime/) — the current runtime page.
- [Migration to v4](/docs/v4/angular-adapter/migration-v4/) — the upgrade path, including the bootstrap rewrite.
- [Legacy Runtime](../runtime/index.md) — the classic runtime package itself, and why it was superseded.
- [v3 vs v4](/docs/v4/v3-vs-v4/) — every breaking change between the lines, in one place.
