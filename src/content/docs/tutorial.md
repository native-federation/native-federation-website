---
applies_to: [v4]
---

# Tutorial

> Step-by-step tutorial for setting up Native Federation v4 with Angular 22 — configure a host and remote, share dependencies, and load Micro Frontends at runtime with the Orchestrator.

Set up a complete Micro Frontend architecture with Native Federation from scratch. You'll create a host (shell) and a remote (Micro Frontend) that load shared dependencies at runtime — on Angular 22 with the v4 adapter and the Orchestrator runtime.

> **See it running first** — the [playground/angular/simple](https://github.com/native-federation/playground/tree/main/angular/simple) example is a complete v4 host with several remotes. Clone it to compare against what you build here, or browse the [live Tractor Store demo](https://native-federation.github.io/playground).

## Prerequisites

- Angular CLI 20 or higher — this tutorial targets **Angular 22**
- Node.js (LTS recommended)

## 1. Create the Workspace

v4 has no dedicated starter branch, so scaffold a fresh workspace with two applications: a `shell` (the host) and a Micro Frontend called `mfe1` (the remote).

```bash
ng new mf-tutorial --no-create-application

cd mf-tutorial

ng generate application shell --routing
ng generate application mfe1 --routing
```

On Angular 22 both applications are standalone and zoneless by default — exactly what Native Federation expects.

## 2. Install Native Federation

```bash
npm i @angular-architects/native-federation -D
```

> **Which package?** From **Angular 22** the adapter is back under its original name, `@angular-architects/native-federation` (22.x). If you are still on **Angular 20 or 21**, install `@angular-architects/native-federation-v4` instead — it's the same adapter under a different name, so substitute `-v4` in every command and import below. Pin the adapter to the same major as your Angular CLI.

The package pulls in `@softarc/native-federation` (`^4.3.0`) and `@softarc/native-federation-orchestrator` (`^4.5.0`). The `init` step below also adds `es-module-shims` and rewires your build targets — nothing else to install up front.

## 3. Initialize the Remote

Configure `mfe1` as a remote that exposes components:

```bash
ng g @angular-architects/native-federation:init --project mfe1 --port 4201 --type remote
```

## 4. Initialize the Host

Configure the `shell` as a dynamic host that reads remote configuration at runtime:

```bash
ng g @angular-architects/native-federation:init --project shell --port 4200 --type dynamic-host
```

> **Note:** A dynamic host reads configuration from a `.json` file at runtime. This lets you change which remotes are loaded without rebuilding the application.

## 5. Host Configuration

v4 configuration is **ESM** — the file is `federation.config.mjs` and uses `import` / `export default` instead of `require()` / `module.exports`. The generated host config at `projects/shell/federation.config.mjs`:

```js
import { withNativeFederation, shareAll } from '@angular-architects/native-federation/config';

export default withNativeFederation({
  name: 'shell',

  shared: {
    ...shareAll(
      { singleton: true, strictVersion: true, requiredVersion: 'auto', build: 'package' },
      {
        overrides: {
          '@angular/core': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            build: 'package',
            includeSecondaries: { keepAll: true },
          },
        },
      },
    ),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    // Add further packages you don't need at runtime
  ],

  features: {
    // ignoreUnusedDeps is enabled by default now
    denseChunking: true,
  },
});
```

> **Note:** `ignoreUnusedDeps` is on by default in v4, so only the secondary entry points you actually import are shared. `@angular/core` opts out via `includeSecondaries: { keepAll: true }` so the framework is never split across versions. See [Angular Config](angular-adapter/configuration.md) for the full breakdown.

## 6. Remote Configuration

The generated remote config at `projects/mfe1/federation.config.mjs` is the same, plus an `exposes` block:

```js
import { withNativeFederation, shareAll } from '@angular-architects/native-federation/config';

export default withNativeFederation({
  name: 'mfe1',

  exposes: {
    './Component': './projects/mfe1/src/app/app.component.ts',
  },

  shared: {
    ...shareAll(
      { singleton: true, strictVersion: true, requiredVersion: 'auto', build: 'package' },
      {
        overrides: {
          '@angular/core': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            build: 'package',
            includeSecondaries: { keepAll: true },
          },
        },
      },
    ),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    // Add further packages you don't need at runtime
  ],

  features: {
    denseChunking: true,
  },
});
```

## 7. Host Bootstrap

The generated `projects/shell/src/main.ts` initializes federation with the **Orchestrator** — v4's recommended runtime — before loading Angular:

```ts
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
  .catch((err) => console.error(err))
  .then((_) => import('./bootstrap'))
  .catch((err) => console.error(err));
```

> **Note:** The Orchestrator is the new default in v4. It adds semver-aware version resolution and caches `remoteEntry.json` files across reloads. The Classic Runtime is still supported — see [v3 vs v4](v3-vs-v4.md#runtime-orchestrator-vs-classic).

## 8. Federation Manifest

The manifest at `projects/shell/src/assets/federation.manifest.json` maps remote names to their entry points:

```json
{
  "mfe1": "http://localhost:4201/remoteEntry.json"
}
```

> **Warning:** Make sure this entry points to port **4201**. Native Federation generates the `remoteEntry.json` automatically — it contains metadata about the remote.

## 9. Remote Bootstrap

The remote's `projects/mfe1/src/main.ts` initializes federation through the Angular adapter:

```ts
import { initFederation } from '@angular-architects/native-federation';

initFederation()
  .catch((err) => console.error(err))
  .then((_) => import('./bootstrap'))
  .catch((err) => console.error(err));
```

## 10. Load the Remote

Add a lazy route to the shell's routing configuration at `projects/shell/src/app/app.routes.ts`. Loading a remote is plain Angular lazy-loading with `loadRemoteModule` in place of a dynamic `import()`:

```ts
import { Routes } from '@angular/router';
import { loadRemoteModule } from '@angular-architects/native-federation';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    pathMatch: 'full',
  },
  {
    path: 'flights',
    loadComponent: () =>
      loadRemoteModule('mfe1', './Component').then((m) => m.AppComponent),
  },
  {
    path: '**',
    component: NotFoundComponent,
  },
];
```

> **Note:** That top-level `loadRemoteModule` is convenient but deprecated. For the recommended pattern — taking `loadRemoteModule` off the resolved `initFederation` promise and threading it through Angular's DI — see [Angular Adapter → Runtime](angular-adapter/runtime.md).

## 11. Run the Application

Start the remote first:

```bash
ng serve mfe1 -o
```

Once it's running, start the shell in another terminal:

```bash
ng serve shell -o
```

Navigate to the `flights` route to load the remote component into the host. The Micro Frontend is loaded at runtime — the shell had no knowledge of it at build time.

## What's Next?

- [Angular Adapter — Getting Started](angular-adapter/getting-started.md)
- [Set up SSR & Hydration](ssr-hydration.md)
- [Combine with Module Federation](native-and-module-federation.md)
- [Frequently Asked Questions](faq.md)
