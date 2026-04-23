---
applies_to: [v3, v4]
---

# Getting Started with the Orchestrator

> Integrate the @softarc/native-federation-orchestrator into any HTML page — from the drop-in quickstart bundle to a fully customized orchestrator script.

This page walks through three ways to wire the orchestrator into a host — the drop-in **quickstart** bundle for plain HTML pages, the **event registry** for race-free module loading, and a fully custom **orchestrator script** you bundle yourself for production.

> **Note:** The orchestrator is a _host-side_ library. Your remotes are still built the usual way ([core](../core/getting-started.md), [Angular adapter](../angular-adapter/index.md), [esbuild adapter](../adapters/esbuild/index.md), …) and just need to publish a standard `remoteEntry.json`.

## Prerequisites

- Basic HTML and JavaScript.
- One or more remotes that publish a `remoteEntry.json` (built with `@softarc/native-federation` v3 or v4).

## 1. Quickstart — drop-in HTML

The simplest integration uses the pre-built `quickstart.mjs` runtime and a declarative manifest in the DOM. No npm install, no bundler — everything lives in the HTML.

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My Application</title>

    <!-- Enable shim-mode for optimal browser support (optional) -->
    <script type="esms-options">
      { "shimMode": true }
    </script>

    <!-- Define your remotes -->
    <script type="application/json" id="mfe-manifest">
      {
        "team/mfe1": "http://localhost:3000/remoteEntry.json",
        "team/mfe2": "http://localhost:4000/remoteEntry.json"
      }
    </script>

    <!-- Load remote modules once the orchestrator is ready -->
    <script>
      window.addEventListener(
        'mfe-loader-available',
        e => {
          e.detail.loadRemoteModule('team/mfe1', './Button');
          e.detail.loadRemoteModule('team/mfe2', './Header');
        },
        { once: true }
      );
    </script>

    <!-- Include the orchestrator -->
    <script src="https://unpkg.com/@softarc/native-federation-orchestrator@4.0.2/quickstart.mjs"></script>
  </head>
  <body>
    <my-header></my-header>
    <my-button>Click me</my-button>
  </body>
</html>
```

### Three pieces, three responsibilities

**The manifest** (`<script type="application/json" id="mfe-manifest">`) tells the orchestrator where every remote lives. The `id="mfe-manifest"` is required — `quickstart.mjs` specifically looks up that element. Each key is the logical remote name used by `loadRemoteModule`; each value is the URL of a `remoteEntry.json`.

> **Note:** In production, you'll often fetch the manifest from a discovery service (feature-flag backend, micro-frontend registry, tenant-aware feed) rather than hard-coding it. For that, use the [custom implementation](#custom-implementation) below and pass `initFederation` a URL instead of an object.

**The event handler** listens for `mfe-loader-available`. Initialization is asynchronous — the orchestrator fetches every `remoteEntry.json`, resolves shared versions, writes the import map, and only then fires the event with `{ loadRemoteModule }` attached to `event.detail`. The `{ once: true }` flag avoids double-wiring.

**The runtime script** performs all the orchestration work. It must appear _after_ the manifest and the event listener in the DOM — it runs immediately and fires the event as soon as the import map is live.

### Rendering the components

Remotes typically register [custom elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) when their module executes. The elements in your HTML stay empty until the corresponding module loads — which happens inside `loadRemoteModule`.

## 2. Avoiding race conditions — the event registry

Native DOM events are fire-and-forget: a listener attached after the event fires never hears it. For hosts that add listeners late (framework bootstrap, async imports, user navigation) the orchestrator ships a small **event registry** that replays the ready event and resolves promises retroactively.

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My Application</title>

    <!-- 1. Init the registry BEFORE any consumers -->
    <script src="https://unpkg.com/@softarc/native-federation-orchestrator@4.0.2/init-registry.mjs"></script>

    <script type="esms-options">{ "shimMode": true }</script>

    <!-- 2. Manifest -->
    <script type="application/json" id="mfe-manifest">
      {
        "team/mfe1": "http://localhost:3000/remoteEntry.json",
        "team/mfe2": "http://localhost:4000/remoteEntry.json"
      }
    </script>

    <!-- 3. Consumer can register whenever — even after ready -->
    <script>
      window.__NF_REGISTRY__.onReady('orch.init-ready', ({ loadRemoteModule }) => {
        loadRemoteModule('team/mfe1', './Button');
        loadRemoteModule('team/mfe2', './Header');
      });
    </script>

    <!-- 4. The orchestrator -->
    <script src="https://unpkg.com/@softarc/native-federation-orchestrator@4.0.2/quickstart.mjs"></script>
  </head>
  <body>
    <my-header></my-header>
    <my-button>Click me</my-button>
  </body>
</html>
```

> **Note:** The registry is also a clean channel for remote-to-remote communication after initialization — any module can `emit` and any other can `onReady`.

## 3. Custom orchestrator — production builds

For production-grade hosts you usually want a bundled orchestrator you control: custom loggers (Sentry, Bugsnag), remote discovery over HTTP, integration with a framework bootstrap, explicit error handling. That's what `initFederation` is for.

### Install

```bash
npm install @softarc/native-federation-orchestrator es-module-shims
```

[es-module-shims](https://www.npmjs.com/package/es-module-shims) polyfills [import maps](https://caniuse.com/import-maps) for older browsers and is also needed for the orchestrator's dynamic-init flow. Even when targeting modern browsers, including it broadens compatibility.

### Write the orchestrator script

```ts
// src/orchestrator.ts
import 'es-module-shims';
import { initFederation } from '@softarc/native-federation-orchestrator';
import {
  consoleLogger,
  sessionStorageEntry,
  useShimImportMap,
} from '@softarc/native-federation-orchestrator/options';

(async () => {
  const manifest = {
    'team/button': 'http://localhost:3000/remoteEntry.json',
    'team/header': 'http://localhost:4000/remoteEntry.json',
  };

  try {
    const { loadRemoteModule } = await initFederation(manifest, {
      logLevel: 'error',
      logger: consoleLogger,
      storage: sessionStorageEntry,
      ...useShimImportMap({ shimMode: true }),
    });

    await Promise.all([
      loadRemoteModule('team/button', './Button'),
      loadRemoteModule('team/header', './Header'),
    ]);
  } catch (error) {
    console.error('Failed to initialize micro frontends:', error);
    // application-specific fallback
  }
})();
```

`initFederation` accepts either an inline manifest object or a URL string that points to a remote manifest file; both forms return a promise that resolves with the loader API (see [Loading remote modules](#load-remote-module)).

### Embed it in the host page

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Application</title>
    <script type="esms-options">{ "shimMode": true }</script>
    <script async src="https://ga.jspm.io/npm:es-module-shims@2.6.0/dist/es-module-shims.js"></script>
  </head>
  <body>
    <my-header></my-header>
    <my-button>Click me</my-button>

    <script type="module-shim" src="./orchestrator.js"></script>
  </body>
</html>
```

`type="module-shim"` tells es-module-shims to execute the script under its own loader — which is what enables the orchestrator to inject new import maps after the page loaded. On evergreen browsers you can also use `type="module"` when you don't need dynamic init.

### Bundling the orchestrator

Produce a single file so the host only loads one script. Any bundler works — esbuild is the lightest:

```js
// build.js
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/orchestrator.ts'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/orchestrator.min.js',
  minify: true,
  platform: 'browser',
  target: 'es2022',
});
```

## Loading remote modules

`initFederation` resolves with a `NativeFederationResult` that exposes six properties. `loadRemoteModule`, `load`, and both functions inside `as<T>()` all delegate to the same underlying loader — they only differ in their TypeScript types.

```ts
const {
  loadRemoteModule,   // <T = unknown>(remoteName, exposedModule) => Promise<T>
  load,               // alias of loadRemoteModule
  as,                 // typed-loader factory: <T>() => { loadRemoteModule, load }
  config,             // resolved ConfigContract (logger, storage, import-map fns)
  adapters,           // DrivingContract — the cache repos + providers + browser/sse
  initRemoteEntry,    // (url, name?) => Promise<NativeFederationResult> — dynamic init
} = await initFederation(manifest, { /* options */ });

// Side-effectful loading (e.g. custom-element registration)
await loadRemoteModule('team/button', './Button');
await load('team/button', './Button');                              // identical

// Typed loading (TypeScript) — generic on the call
const btn1 = await loadRemoteModule<ButtonModule>('team/button', './Button');

// Typed loading — scoped factory (handy when you reuse the same type)
const typed = as<ButtonModule>();
const btn2 = await typed.loadRemoteModule('team/button', './Button');

// Read the resolved configuration
console.log(config);
```

`config` is the `ConfigContract` — the merged result of your options and the library defaults. It exposes the active logger, storage handle and import-map functions, so you can reach the orchestrator's internals from anywhere without re-creating them.

`adapters` is the `DrivingContract` — a hexagonal-architecture concept (see [Hexagonal Architecture: there are always two sides to every story](https://medium.com/ssense-tech/hexagonal-architecture-there-are-always-two-sides-to-every-story-bc0780ed7d9c)) giving direct handles to `remoteInfoRepo`, `sharedExternalsRepo`, `scopedExternalsRepo`, `sharedChunksRepo`, the manifest and remote-entry providers, and the browser/SSE adapters. Use it to introspect the caches described in [Architecture — caches](architecture.md#caches).

`initRemoteEntry(remoteEntryUrl, remoteName?)` adds a remote after the initial load and resolves with the same `NativeFederationResult` shape (so the chain can continue). See [Dynamic init](version-resolver.md#dynamic-init) for the rules and constraints.

## Configuration at a glance

Everything below has its own page — this section is a tour. Full reference: [Configuration](configuration.md).

### Storage

The orchestrator caches processed `remoteEntry.json` data and resolved shared externals between page loads. That's the real win for server-rendered hosts.

```ts
import {
  globalThisStorageEntry,   // in-memory, default — fastest, lost on reload
  sessionStorageEntry,      // persists within the browser session
  localStorageEntry,        // persists across browser restarts
} from '@softarc/native-federation-orchestrator/options';

await initFederation(manifest, {
  storage: sessionStorageEntry,
  storageNamespace: '__NATIVE_FEDERATION__',
  clearStorage: false,
});
```

In memory (`globalThisStorageEntry`) is the default — fastest, but wiped on every reload, so it only helps SPAs that never refresh the page. Session storage is the sweet spot for multi-page SSR hosts: caching survives navigation but dies with the tab. Local storage persists across browser restarts, which maximizes cache hits for returning visitors, but is generally discouraged because stale entries can outlive a remote deploy.

### Import map implementation

```ts
// Native import maps (default)
await initFederation(manifest, {
  loadModuleFn: url => import(url),
});

// es-module-shims (broader browser support, enables dynamic init)
await initFederation(manifest, {
  ...useShimImportMap({ shimMode: true }),
});
```

### Logging

```ts
import { consoleLogger, noopLogger } from '@softarc/native-federation-orchestrator/options';

await initFederation(manifest, {
  logLevel: 'debug',          // 'debug' | 'warn' | 'error'
  logger: consoleLogger,      // or noopLogger, or a custom implementation
});
```

Custom loggers implement `{ debug, warn, error }` with a `(step: number, msg: string, details?: unknown)` signature, which is how you wire the orchestrator into Sentry, Bugsnag or your own telemetry.

### Host remote entry

```ts
await initFederation(manifest, {
  hostRemoteEntry: {
    url: './host-remoteEntry.json',
    cacheTag: 'v1.2.3',       // optional cache-buster
  },
});
```

The `hostRemoteEntry` is the host's own `remoteEntry.json` — the _host_ participating in federation as a first-class peer. By design, it has **precedence over every other remote entry**: for any shared dependency the host declares, the host's version is the one committed to the import map for that scope. The version resolver is bypassed entirely for those packages.

Use it to **force or lock a specific version** of a dependency across the whole application — Angular, React, a design system, a shared SDK — without relying on whatever the resolver would otherwise pick from the remotes. Anything the host does _not_ declare keeps going through normal resolution. The optional `cacheTag` lets you invalidate the cached host entry after a deploy without changing its URL.

If you _don't_ want the host's versions to take precedence, just drop the `hostRemoteEntry` option and add the same `remoteEntry.json` to the manifest as a regular remote instead:

```ts
await initFederation({
  'shell':      './host-remoteEntry.json',  // treated like any other remote
  'team/mfe1':  'http://localhost:3000/remoteEntry.json',
  'team/mfe2':  'http://localhost:4000/remoteEntry.json',
});
```

In this form the host participates in federation but doesn't win version fights — its shared dependencies go through the same resolver as every other remote, which is useful when the host is just another peer rather than the authority.

## Framework integration

The orchestrator only needs a browser and a script tag, so it drops into any framework. Below is the Angular flow; the same pattern works for Vue, Svelte and other SPA frameworks — initialize first, bootstrap second.

### Angular host

```ts
// src/main.ts
import { initFederation } from '@softarc/native-federation-orchestrator';
import { useShimImportMap } from '@softarc/native-federation-orchestrator/options';

initFederation(
  {},
  {
    hostRemoteEntry: './remoteEntry.json',
    ...useShimImportMap({ shimMode: true }),
  }
)
  .then(async nf => {
    const app = await nf.loadRemoteModule<typeof import('./bootstrap')>(
      '__NF-HOST__',
      './bootstrap'
    );
    await app.bootstrap(nf.loadRemoteModule);
  })
  .catch(err => {
    console.error('Failed to load app!', err);
  });
```

`loadRemoteModule` routes through the orchestrator's `loadModuleFn` — in shim mode, that's `importShim`, which actually sees the import map the orchestrator just committed. A raw `import('./bootstrap')` would bypass the shim loader and miss every shared external. The `'__NF-HOST__'` name is the default assigned to `hostRemoteEntry` (override it via `hostRemoteEntry.name`), and `./bootstrap` must be listed in the host's `federation.config.mjs` under `exposes`.

```ts
// src/bootstrap.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { ApplicationConfig, InjectionToken, provideZoneChangeDetection } from '@angular/core';
import { AppComponent } from './app/app.component';
import { LoadRemoteModule } from '@softarc/native-federation-orchestrator';

export const MODULE_LOADER = new InjectionToken<LoadRemoteModule>('MODULE_LOADER');

const appConfig = (loader: LoadRemoteModule): ApplicationConfig => ({
  providers: [
    { provide: MODULE_LOADER, useValue: loader },
    provideZoneChangeDetection({ eventCoalescing: true }),
  ],
});

export const bootstrap = (loader: LoadRemoteModule) =>
  bootstrapApplication(AppComponent, appConfig(loader))
    .catch(err => console.error(err));
```

Injecting `MODULE_LOADER` keeps routing, guards and services framework-idiomatic while still backed by the orchestrator's import map.

## Next steps

- [Architecture](architecture.md) — the domain model behind the runtime.
- [Configuration](configuration.md) — every option, with defaults.
- [Version Resolver](version-resolver.md) — how the orchestrator picks which versions to share.
