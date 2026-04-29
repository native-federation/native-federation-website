---
applies_to: [v3, v4]
---

# Runtime

> The runtime side of the Angular adapter — initFederation, loadRemoteModule, lazy routes, and the optional orchestrator runtime.

The Angular adapter doesn't ship its own runtime — it re-exports `initFederation` and `loadRemoteModule` from `@softarc/native-federation-runtime` (on v3 under `@angular-architects/native-federation`, on v4 under `@angular-architects/native-federation-v4`). This page covers how the two integrate with an Angular bootstrap and what changes when you opt into the new [orchestrator](../runtime/index.md) runtime.

**On this page**

- [The bootstrap split](#the-bootstrap-split)
- [initFederation](#initfederation)
- [loadRemoteModule](#loadremotemodule)
- [The federation manifest](#the-federation-manifest)
- [Opting into the orchestrator](#opting-into-the-orchestrator)

## The Bootstrap Split

Native Federation must wire the import map _before_ Angular evaluates any module that depends on a shared external. The schematic enforces this by splitting `main.ts` in two:

```ts
// projects/<project>/src/main.ts
import { initFederation } from '@angular-architects/native-federation';

initFederation('/assets/federation.manifest.json')
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
```

```ts
// projects/<project>/src/bootstrap.ts
// ← whatever your original main.ts contained, e.g.
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));
```

The dynamic `import('./bootstrap')` is mandatory: it forces the bundler to put your Angular code in a separate chunk that's only loaded once the import map is live.

## initFederation

```ts
initFederation(remotesOrManifest?, options?): Promise<void>
```

- **Host (dynamic).** Pass the manifest URL: `initFederation('/assets/federation.manifest.json')`.
- **Host (static).** Pass the remote map inline: `initFederation({ mfe1: 'http://localhost:4201/remoteEntry.json' })`.
- **Remote.** Pass a self-map: `initFederation({ mfe1: './remoteEntry.json' })`. This lets the remote's runtime register its own shared modules so the host can match versions.

The schematic emits the right call for the project type you chose — see [Schematics → init](schematics.md#init--ng-add).

## loadRemoteModule

```ts
loadRemoteModule(remoteName, exposedKey): Promise<unknown>
```

Once `initFederation` resolves, you can lazy-load any exposed module from any registered remote. In an Angular shell this is normal lazy-loading:

```ts
// projects/shell/src/app/app.routes.ts
import { Routes } from '@angular/router';
import { loadRemoteModule } from '@angular-architects/native-federation';

export const APP_ROUTES: Routes = [
  {
    path: 'flights',
    loadComponent: () =>
      loadRemoteModule('mfe1', './Component').then(m => m.AppComponent),
  },
  {
    path: 'orders',
    loadChildren: () =>
      loadRemoteModule('mfe2', './Routes').then(m => m.ORDERS_ROUTES),
  },
];
```

`remoteName` matches the `name` in the remote's `federation.config.mjs` (or `.js` on v3 / legacy projects) and the key in the host's manifest. `exposedKey` matches the key under `exposes`. The promise resolves to the module's exports — whatever you'd get from a regular dynamic `import()`.

## The Federation Manifest

For dynamic hosts, the manifest is just a JSON object mapping remote name → `remoteEntry.json` URL:

```json
{
  "mfe1": "http://localhost:4201/remoteEntry.json",
  "mfe2": "https://cdn.example.com/orders/remoteEntry.json"
}
```

Swap it per environment by deploying a different `federation.manifest.json` alongside the shell — no rebuild required. The schematic places it under `public/` if the project has a public folder, otherwise under `src/assets/`.

> **Note:** Manifest URLs may be absolute (production CDN) or relative (local dev or same-origin deploys). For Angular SSR the same manifest is consumed server-side by `@softarc/native-federation-node`; see [SSR & Hydration](ssr.md).

## Opting into the Orchestrator

The legacy runtime (`@softarc/native-federation-runtime`, re-exported from the adapter as `@angular-architects/native-federation` on v3 and `@angular-architects/native-federation-v4` on v4) is the v3 default and remains fully supported on v4. v4 introduces a more capable runtime — the **orchestrator** — with range-based version selection, share scopes, in-browser caching, configurable storage, and pluggable loggers.

On v4 the `init` schematic generates orchestrator-flavoured bootstraps by default, and `update-v4 --orchestrator` rewrites an existing `main.ts` onto the orchestrator. Manually, the migration looks like this:

```ts
// projects/shell/src/main.ts
import { initFederation } from '@softarc/native-federation-orchestrator';
import {
  useShimImportMap,
  consoleLogger,
  globalThisStorageEntry,
} from '@softarc/native-federation-orchestrator/options';

initFederation('/assets/federation.manifest.json', {
  ...useShimImportMap({ shimMode: true }),
  logger: consoleLogger,
  storage: globalThisStorageEntry,
  hostRemoteEntry: './remoteEntry.json',
  logLevel: 'debug',
})
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
```

The biggest behavioural change is that `loadRemoteModule` is no longer a global export — it's returned from the resolved `initFederation` promise. That nudges your bootstrap into a controlled flow:

```ts
// projects/shell/src/main.ts
import { initFederation, NativeFederationResult } from '@softarc/native-federation-orchestrator';

initFederation('/assets/federation.manifest.json')
  .then(({ loadRemoteModule }: NativeFederationResult) =>
    import('./bootstrap').then((m: any) => m.bootstrap(loadRemoteModule)))
  .catch(err => console.error(err));
```

```ts
// projects/shell/src/bootstrap.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { LoadRemoteModule } from '@softarc/native-federation-orchestrator';

export const bootstrap = (loadRemoteModule: LoadRemoteModule) =>
  bootstrapApplication(AppComponent, appConfig(loadRemoteModule))
    .catch(err => console.error(err));
```

And then pass the loader through Angular's DI so routes can use it:

```ts
// projects/shell/src/app/app.config.ts
import { ApplicationConfig, InjectionToken, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Routes } from '@angular/router';
import { LoadRemoteModule } from '@softarc/native-federation-orchestrator';

export const MODULE_LOADER = new InjectionToken<LoadRemoteModule>('loader');

const routes = (loadRemoteModule: LoadRemoteModule): Routes => [
  {
    path: 'mfe3',
    loadComponent: () =>
      loadRemoteModule('mfe3', './Component').then((m: any) => m.AppComponent),
  },
];

export const appConfig = (loadRemoteModule: LoadRemoteModule): ApplicationConfig => ({
  providers: [
    { provide: MODULE_LOADER, useValue: loadRemoteModule },
    provideZonelessChangeDetection(),
    provideRouter(routes(loadRemoteModule)),
  ],
});
```

Slightly more boilerplate, but the loader is guaranteed to exist by the time anything tries to use it. The full list of orchestrator options lives in the [runtime docs](../runtime/index.md).

## Related

- [Runtime overview](../runtime/index.md) — the orchestrator's full feature set.
- [SSR & Hydration](ssr.md) — initialising federation on the Node side.
- [Migration to v4](migration-v4.md) — switching from the legacy runtime to the orchestrator.
