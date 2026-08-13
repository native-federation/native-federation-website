# Runtime (v4)

> The goal of the runtime is to hook native-federation into your Angular application. The runtime is distinguishable by the `initFederation()` function, which can be imported from `@softarc/native-federation-orchestrator` and `@angular-architects/native-federation`. That function initializes native-federation and builds-up the importmap, it returns the `loadRemoteModule` function which can be used to load/init the micro frontends (remotes) on demand. Both thin wrappers over the orchestrator. After running the schematics, the generated `main.ts` calls the `initFederation` wrapper. This page covers how that integrates with an Angular bootstrap, and how to thread the resulting loader through your Angular app.

> **Note:** **On v3?** The v3 adapter is a straight re-export of the classic `@softarc/native-federation-runtime`, and its API differs from what is documented here — see [Runtime (v3)](/docs/v3/angular-adapter/runtime/). To move across, see [Migration to v4](migration-v4.md).

**On this page**

- [The bootstrap split](#the-bootstrap-split)
- [initFederation](#initfederation)
- [loadRemoteModule](#loadremotemodule)
- [The federation manifest](#the-federation-manifest)
- [Wiring the result into Angular](#wiring-the-result-into-angular)
- [Dynamic remotes](#dynamic-remotes)

## The Bootstrap Split

Native Federation must wire the import map _before_ Angular evaluates any module that depends on a shared external. The schematic enforces this by splitting `main.ts` in two:

```ts
// projects/<project>/src/main.ts
import { initFederation } from "@angular-architects/native-federation";

initFederation("federation.manifest.json", {
  hostRemoteEntry: { url: "./remoteEntry.json" },
})
  .catch((err) => console.error(err))
  .then((_) => import("./bootstrap"))
  .catch((err) => console.error(err));
```

```ts
// projects/<project>/src/bootstrap.ts
// ← whatever your original main.ts contained, e.g.
import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err),
);
```

The dynamic `import('./bootstrap')` is recommended: it forces the bundler to put your Angular code in a separate chunk that's only loaded once the import map is live.

The first argument is whatever `--type` implies — the manifest path for a `dynamic-host`, an inline remote map for a `host`, `{}` for a `remote`. The manifest path is emitted **relative** (`federation.manifest.json` next to `index.html`, or `assets/federation.manifest.json` for projects without a `public/` folder), so it survives a sub-path deploy.

## initFederation

The adapter's `initFederation` wraps the orchestrator with sensible defaults (shim import map, console logger, `hostRemoteEntry: './remoteEntry.json'`) and resolves to a `NativeFederationResult`:

```ts
initFederation(
  remotesOrManifestUrl?: Record<string, string> | string,
  options?: NgNFOptions,
): Promise<NativeFederationResult>
```

- **Host (dynamic).** Pass the manifest URL: `initFederation('federation.manifest.json')`.
- **Host (static).** Pass the remote map inline: `initFederation({ mfe1: 'http://localhost:4201/remoteEntry.json' })`.
- **Remote.** Pass nothing: `initFederation()`. A remote registers its own shared modules through `hostRemoteEntry` (defaulted to `./remoteEntry.json`), which the orchestrator folds into the manifest under a reserved name, so the host can match versions against it. This property is important since the `hostRemoteEntry` has precedence over all other `remoteEntries.json`. it's goal is to enforce a certain version of all dependencies used by the host. In other words, if you want the host's dependencies to always be chosen as the shared version, use `hostRemoteEntry`.

The first argument is **optional**, and nothing about it is fixed at build time: pass a URL, pass an object you computed a millisecond earlier, or pass nothing at all and add every remote later with `initRemoteEntry`. A manifest file is the default the schematic scaffolds, not a requirement — see [Dynamic remotes](#dynamic-remotes).

### Options

The second argument is `NgNFOptions` — the orchestrator's full [`NFOptions`](../orchestrator/configuration.md) plus two adapter-specific keys:

| Option     | Type      | Default | Description                                                                                                                                                                                   |
| ---------- | --------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shimMode` | `boolean` | `true`  | Selects `useShimImportMap({ shimMode: true })` or, when `false`, `useDefaultImportMap()` for native import maps. Must match the builder's [`esmsInitOptions`](builder.md#native-import-maps). |
| `cacheTag` | `string`  | —       | **Deprecated.** Pass it on `hostRemoteEntry` instead: `hostRemoteEntry: { url: './remoteEntry.json', cacheTag: '…' }`.                                                                        |

Everything else is handed straight to the orchestrator and overrides the adapter's defaults, so options like `logLevel`, `sse`, `logger`, `storage` and `hostRemoteEntry` are set exactly as they are documented for the orchestrator:

```ts
initFederation("federation.manifest.json", {
  sse: true,
  logLevel: "info",
  hostRemoteEntry: { url: "./remoteEntry.json", cacheTag: BUILD_HASH },
});
```

> **Note:** Older adapter releases took a narrow, adapter-only options type with a `logging` key. It is now called `logLevel`, like everywhere else in the orchestrator, and it is no longer forced to `'debug'` — leave it out and the orchestrator's own default applies.

The resolved `NativeFederationResult` carries the `loadRemoteModule` you should use (see below). The `init` schematic emits the right call against this wrapper for the project type you chose. See [Schematics → init](schematics.md#init--ng-add).

## loadRemoteModule

```ts
loadRemoteModule(remoteName, exposedKey): Promise<unknown>
```

Once `initFederation` resolves, you can lazy-load any exposed module from any registered remote. In an Angular shell this is normal lazy-loading:

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

`remoteName` matches the `name` in the remote's `federation.config.mjs` and the key in the host's manifest. `exposedKey` matches the key under `exposes`. The promise resolves to the module's exports — whatever you'd get from a regular dynamic `import()`.

> **Deprecated.** This top-level `loadRemoteModule` import is kept for backwards compatibility with v3 call sites but is deprecated — it resolves against a module-scoped instance from the most recent `initFederation` call, which is brittle in tests and multi-host setups. Prefer the `loadRemoteModule` returned by the `initFederation` promise and thread it through Angular's DI (see [below](#wiring-the-result-into-angular)).

## The Federation Manifest

For dynamic hosts, the manifest is just a JSON object mapping remote name → `remoteEntry.json` URL:

```json
{
  "mfe1": "http://localhost:4201/remoteEntry.json",
  "mfe2": "https://cdn.example.com/orders/remoteEntry.json"
}
```

Swap it per environment by deploying a different `federation.manifest.json` alongside the shell — no rebuild required. The schematic generates it for `dynamic-host` projects only, under `public/` if the project has a public folder, otherwise under `src/assets/` — and passes the matching relative path (`federation.manifest.json` or `assets/federation.manifest.json`) to `initFederation`, which resolves against the document — so the shell survives a sub-path deploy.

> **Note:** The remote-entry URLs inside the manifest may be absolute (production CDN) or relative (local dev or same-origin deploys). For Angular SSR the same manifest is consumed server-side by the orchestrator's [`/node` entry](../orchestrator/node.md); see [SSR & Hydration](ssr.md).

## Wiring the Result Into Angular

The resolved `NativeFederationResult` _is_ the runtime: `loadRemoteModule` for exposed modules, `initRemoteEntry` for remotes registered after startup, `as<T>()` for a typed loader, and the resolved `config`. The [top-level `loadRemoteModule`](#loadremotemodule) reaches the same runtime through a module-scoped instance, which is what makes it brittle. Threading the result through your app instead gives every route, component and test one explicit handle on it.

Start by handing the result to your bootstrap rather than dropping it:

```ts
// projects/shell/src/main.ts
import {
  initFederation,
  NativeFederationResult,
} from "@angular-architects/native-federation";

initFederation("federation.manifest.json", {
  hostRemoteEntry: { url: "./remoteEntry.json" },
})
  .then((nf: NativeFederationResult) =>
    import("./bootstrap").then((m) => m.bootstrap(nf)),
  )
  .catch((err) => console.error(err));
```

```ts
// projects/shell/src/bootstrap.ts
import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";
import { NativeFederationResult } from "@angular-architects/native-federation";

export const bootstrap = (nf: NativeFederationResult) =>
  bootstrapApplication(AppComponent, appConfig(nf)).catch((err) =>
    console.error(err),
  );
```

Then provide it through Angular's DI, so everything downstream resolves the same instance:

```ts
// projects/shell/src/app/app.config.ts
import {
  ApplicationConfig,
  InjectionToken,
  provideZonelessChangeDetection,
} from "@angular/core";
import { provideRouter } from "@angular/router";
import { NativeFederationResult } from "@angular-architects/native-federation";
import { routes } from "./app.routes";

export const MODULE_LOADER = new InjectionToken<NativeFederationResult>(
  "loader",
);

export const appConfig = (nf: NativeFederationResult): ApplicationConfig => ({
  providers: [
    { provide: MODULE_LOADER, useValue: nf },
    provideZonelessChangeDetection(),
    provideRouter(routes(nf)),
  ],
});
```

Routes are configured before the injector exists, so they take the result as a parameter:

```ts
// projects/shell/src/app/app.routes.ts
import { Type } from "@angular/core";
import { Routes } from "@angular/router";
import { NativeFederationResult } from "@angular-architects/native-federation";

export const routes = ({
  loadRemoteModule,
}: NativeFederationResult): Routes => [
  {
    path: "mfe3",
    loadComponent: () =>
      loadRemoteModule<{ AppComponent: Type<unknown> }>(
        "mfe3",
        "./Component",
      ).then((m) => m.AppComponent),
  },
];
```

Everything else injects the token:

```ts
// projects/shell/src/app/widgets.service.ts
import { inject, Injectable, Type } from "@angular/core";
import { MODULE_LOADER } from "./app.config";

@Injectable({ providedIn: "root" })
export class WidgetsService {
  private nf = inject(MODULE_LOADER);

  loadWidget(remote: string) {
    return this.nf
      .as<{ WidgetComponent: Type<unknown> }>()
      .loadRemoteModule(remote, "./Widget");
  }

  register(remoteEntryUrl: string, name: string) {
    return this.nf.initRemoteEntry(remoteEntryUrl, name);
  }
}
```

Provide the **whole** result rather than destructuring `loadRemoteModule` out of it — that keeps `initRemoteEntry` ([dynamic remotes](#dynamic-remotes)), `as<T>()` and `config` reachable from anywhere that injects the token, and lets a test swap in a fake through the same seam.

> **Note:** `NgNFOptions` already exposes the orchestrator's full option set, so the adapter's `initFederation` covers custom loggers, storage backends and strictness settings. If you do call `@softarc/native-federation-orchestrator` directly, you take over its defaults — it uses native import maps, while the Angular builder emits `type="module-shim"` script tags, so pass `...useShimImportMap({ shimMode: true })` to keep both sides in agreement. See [Orchestrator → Configuration](../orchestrator/configuration.md).

_Working reference: [`angular/simple/projects/host`](https://github.com/native-federation/playground/tree/main/angular/simple/projects/host) in the playground repo._

## Dynamic Remotes

"Dynamic remotes" covers two different questions, and they have two different answers:

| Question                                                                                               | Answer                                                               |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| The remotes are known, but their **URLs** are decided per environment / tenant / A-B bucket.           | Build the remotes object at runtime and hand it to `initFederation`. |
| The remote itself is **not known at startup** — a feature flag, a lazy route, a plugin the user picks. | Start without it and add it later with `initRemoteEntry`.            |

Neither needs a `federation.manifest.json` on disk. Coming from Module Federation, this pair replaces `setRemoteUrlResolver` / `setRemoteDefinitions` from `@nx/angular/mf`.

### Resolving Remote URLs at Runtime

`initFederation` takes a plain object, so anything you can compute before calling it is fair game — fetch a config endpoint, read a tenant from the URL, consult a feature-flag service:

```ts
// projects/shell/src/main.ts
import {
  initFederation,
  NativeFederationResult,
} from "@angular-architects/native-federation";

fetch("./env.config.json")
  .then((resp) => resp.json())
  .then(async (env) => {
    const nf: NativeFederationResult = await initFederation(
      {
        checkout: `${env.cdnUrl}/checkout/remoteEntry.json`,
        explore: `${env.cdnUrl}/explore/remoteEntry.json`,
      },
      {
        hostRemoteEntry: { url: "./remoteEntry.json" },
      },
    );
    const m = await import("./bootstrap");
    await m.bootstrap(env, nf);
  })
  .catch((err) => console.error(err));
```

The manifest and the remotes object are interchangeable here: `fetch('./federation.manifest.json').then(r => r.json())` gives you the same object with a rewrite step in the middle, which is how the playground's tractor-store hosts pick up a per-environment CDN. That is also the seam for URL rewriting — map, filter, or replace hosts on the object before it reaches `initFederation`.

_Working reference: [`angular/tractor-store/projects/host/src/main.ts`](https://github.com/native-federation/playground/blob/main/angular/tractor-store/projects/host/src/main.ts)._

### Adding Remotes Later with `initRemoteEntry`

```ts
type RemoteRef = string | { name?: string; integrity?: string };

initRemoteEntry(
  remoteEntryUrl: string,
  remote?: RemoteRef,
): Promise<NativeFederationResult>
```

`initRemoteEntry` registers a remote that was not part of `initFederation` and resolves with the **same** `NativeFederationResult` it hangs off — the result you already hold keeps working, and awaiting the promise is what tells you the remote is ready. Chaining into `loadRemoteModule` on the resolved value is simply the shortest way to express that ordering. The second argument is the remote's name, or an object when you also want to pin the entry against an SRI hash (`{ name, integrity }`) — see [Security → Subresource Integrity](../orchestrator/security.md#subresource-integrity).

> **Note:** A failing `initRemoteEntry` does **not** reject by default: the orchestrator logs `Failed to initialize remote entry, continuing anyway` and the error only surfaces at the subsequent `loadRemoteModule`. Set `strict: { strictRemoteEntry: true }` to have registration failures reject instead — see [Configuration → Modes](../orchestrator/configuration.md#modes).

> **Note:** This is the one path that needs **shim mode** (`useShimImportMap`, the adapter's default). A late remote appends a second import map to the DOM, and a native import map can be committed only once per document — so `shimMode: false` rules out `initRemoteEntry`. See [Configuration → Import-map implementation](../orchestrator/configuration.md#import-map).

In a lazy route, that turns "init the remote" and "load the component" into a single `loadComponent`:

```ts
// projects/shell/src/app/app.routes.ts
import { Type } from "@angular/core";
import { Routes } from "@angular/router";
import { NativeFederationResult } from "@angular-architects/native-federation";

export const routes = ({ initRemoteEntry }: NativeFederationResult): Routes => [
  {
    path: "mfe3",
    loadComponent: () =>
      initRemoteEntry("http://localhost:4203/remoteEntry.json", "mfe3")
        .then((nf) =>
          nf
            .as<{ AppComponent: Type<unknown> }>()
            .loadRemoteModule("mfe3", "./Component"),
        )
        .then((m) => m.AppComponent),
  },
];
```

Nothing is fetched until the user navigates to `/mfe3` — the remote costs zero bytes for everyone who never opens that route.

The same works from a component, using the `MODULE_LOADER` token from the [DI setup above](#wiring-the-result-into-angular) — useful for remotes that register a custom element rather than exporting a component:

```ts
// projects/shell/src/app/loading-shell/loading-shell.component.ts
import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from "@angular/core";
import { MODULE_LOADER } from "../app.config";

@Component({
  selector: "app-loading-shell",
  template: `<app-mfe4></app-mfe4>`,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LoadingShellComponent {
  loader = inject(MODULE_LOADER);

  constructor() {
    this.loader
      .initRemoteEntry("http://localhost:4204/remoteEntry.json", "mfe4")
      .then((nf) => nf.loadRemoteModule("mfe4", "./Bootstrap"));
  }
}
```

_Working reference: [`angular/simple/projects/host/src/app/app.routes.ts`](https://github.com/native-federation/playground/blob/main/angular/simple/projects/host/src/app/app.routes.ts)._

**What dynamic init will and won't do.** It is **additive only**. A late remote can introduce new shared packages and join existing share scopes, but it cannot replace, downgrade or re-scope anything the initial pass already resolved — if it needs an incompatible version of an already-shared package it either reuses the resolved one or downloads a private copy (`strictVersion: true`). Remotes with the tightest version requirements are therefore better placed in the initial `initFederation` call. The full rules are in [Version Resolver → Dynamic init](../orchestrator/version-resolver.md#dynamic-init).

### The One-Call Shortcut (Deprecated)

The adapter's top-level `loadRemoteModule` accepts a `remoteEntry` instead of a `remoteName` and does the two steps for you — it fetches the entry to discover the remote's `name`, calls `initRemoteEntry`, then loads the module:

```ts
import { loadRemoteModule } from "@angular-architects/native-federation";

loadRemoteModule({
  remoteEntry: "http://localhost:4203/remoteEntry.json",
  exposedModule: "./Component",
  // resolved instead of rejecting — stands in for the module, so give it the
  // module's shape. Truthy-only: null / 0 / '' count as "no fallback".
  fallback: { AppComponent: FallbackComponent },
}).then((m) => m.AppComponent);
```

This is the [v3-era one-liner](/docs/v3/angular-adapter/runtime/#lazy-remote-registration), kept working so v3 call sites survive the upgrade, but deprecated for the reason given [above](#loadremotemodule): it resolves against a module-scoped instance from the most recent `initFederation` call. Prefer `initRemoteEntry` on an injected result. The `fallback` option has no direct equivalent — catch the rejection yourself:

```ts
initRemoteEntry(url, "mfe3")
  .then((nf) => nf.loadRemoteModule("mfe3", "./Component"))
  .catch(() => ({ AppComponent: FallbackComponent }));
```

## Related

- [Runtime (v3)](/docs/v3/angular-adapter/runtime/) — the same page for the v3 adapter, which re-exports the classic runtime.
- [Orchestrator overview](../orchestrator/index.md) — the orchestrator's full feature set.
- [Version Resolver → Dynamic init](../orchestrator/version-resolver.md#dynamic-init) — the rules dynamic remotes play by.
- [SSR & Hydration](ssr.md) — initialising federation on the Node side.
- [Migration to v4](migration-v4.md) — switching from the legacy runtime to the orchestrator.
