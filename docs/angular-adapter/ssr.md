---
applies_to: [v4]
---

# SSR & Hydration

> Angular SSR and Incremental Hydration with Native Federation — the v4 `node-preload` launch model, host-singleton bridging, federated routes under SSR, boot order, and readiness gating.

The Angular adapter supports Angular SSR and Incremental Hydration — both for hosts and remotes. The server side is driven by a `node --import` **preload** that registers the federation loader before Angular evaluates; most of the wiring is done by the `init` schematic when it detects an SSR-enabled project. This page documents what it generates and the moving parts behind it.

> **Version note.** This page tracks the v4 adapter — `@angular-architects/native-federation` **22.x** on Angular 22 (or `@angular-architects/native-federation-v4` **21.2.x** on Angular 20/21) — and `@softarc/native-federation-orchestrator` **4.2.x** (the *runtime*). A complete worked example is the [Native Federation Angular SSR playground](https://github.com/native-federation/playground/tree/main/angular/ssr).

**On this page**

- [Enabling SSR](#enabling-ssr)
- [The ordering problem](#ordering)
- [Production: the node-preload launch contract](#prod)
- [Dev SSR (`ng serve`)](#dev)
- [Wiring the loader into Angular](#wiring)
- [Federated routes under SSR](#routes)
- [Boot order](#boot-order)
- [Externals on the server](#externals)
- [Manifests & CORS](#manifest)
- [Environment variables](#env)

## Enabling SSR

Add SSR to your Angular project the usual way, then run (or re-run) the federation init:

```bash
ng add @angular/ssr --project host
# then the adapter's init / ng-add schematic
```

When the schematic sees `build.options.ssr.entry` it wires the SSR-specific pieces:

- Sets `ssr: true` on the federation `build` target. The builder uses this flag to route externals through Angular's `externalDependencies` instead of an esbuild plugin (the SSR build path doesn't run that plugin — see [Externals](#externals)).
- Adds `app.use(cors())` to the generated `server.ts` (federated remotes load across origins).
- Switches the scaffolded `RenderMode.Prerender` → `RenderMode.Server` in `app.routes.server.ts` — federated remotes load at runtime and can't be prerendered.
- Forces `security.allowedHosts: ['localhost']` on the `esbuild` target so `@angular/ssr` doesn't reject the localhost `Host` header and silently fall back to CSR.

Server-side init happens at launch via the preload below — you still wire the prod start command yourself.

## <a id="ordering"></a> The ordering problem

Every shared singleton must resolve to exactly one instance. If a remote loaded during SSR pulls in a *second* `@angular/core`, you get **`NG0203`** ("inject() must be called from an injection context") / "JIT compilation failed" — Angular's DI and compiler assume a single core instance.

The orchestrator dedupes by intercepting module resolution through a `module.register()` loader hook. **But `module.register()` only intercepts modules loaded *after* it runs**, so the hook must be installed before *any* `@angular/*` module is loaded. That can't happen in `server.ts`:

1. `server.ts` statically imports `@angular/ssr/node`.
2. `@angular/build` prepends the `@angular/ssr` app-engine registration into the emitted server bundle, so `@angular/*` is in the entry's *static import graph* regardless of what your source does.

ESM evaluates (and, for externals, loads) a module's entire static import graph before the module body runs — so by the time any code in the entry executes, `@angular/*` is already loaded. The registration must therefore happen in a **separate, earlier module graph**. That's what the preload is for.

## <a id="prod"></a> Production: the node-preload launch contract

Launch the server through the adapter's preload:

```bash
node --import @angular-architects/native-federation/node-preload \
     dist/<app>/server/server.mjs
```

`--import` modules are fully evaluated (top-level `await` awaited) **before** Node loads the entry point. The preload installs the loader hook, then Node loads `server.mjs` — whose static `@angular/*` imports are now intercepted. Because `server.mjs` stays the *main* module, its own `isMainModule(import.meta.url)` listen-guard fires unchanged. The build emits the CLI's `server.mjs` as-is; the preload is the only SSR-specific piece, applied purely at launch. **One preload serves the host and every remote.**

What the preload (`@angular-architects/native-federation/node-preload`) does:

```ts
import { initNodeFederation } from '@softarc/native-federation-orchestrator/node';
// Locate the app's browser output dir (holds the federation artifacts):
//   1. NF_BROWSER_DIR env override (absolute or cwd-relative), else
//   2. ../browser relative to the launched entry (process.argv[1]) — the default
//      dist/<app>/{server,browser} layout.
const browserDir = resolveBrowserDir();
const manifestPath    = join(browserDir, 'federation.manifest.json');         // host only
const hostRemoteEntry = pathToFileURL(join(browserDir, 'remoteEntry.json')).href;

const { loadRemoteModule } = await initNodeFederation(
  existsSync(manifestPath) ? manifestPath : {},   // remotes have no manifest → {} still works
  { hostRemoteEntry, hostInstances: 'all' },       // bridge all shared singletons
);
globalThis['__NF_HOST_SERVER_LOADER__'] = loadRemoteModule;   // read by the app (see Wiring)
```

`hostInstances: 'all'` bridges the host's shared singletons so a remote's `@angular/core` (and its secondary entry points, e.g. `@angular/core/rxjs-interop`) resolve to the host's already-loaded instance instead of a duplicate. See [Orchestrator → Node.js / SSR](../orchestrator/node.md) for the mechanism (`__NF_HOST_INSTANCES__`, the `nf-host:` synthesis, `setHostInstances`).

Beyond ordering, the shipped preload also:

- Reconciles the manifest's expected remotes against what actually registered and **logs the gap**:
  ```
  [native-federation] 1 remote(s) not registered at startup: mfe2 — their federated regions will render empty.
  ```
- Publishes a `FederationStatus` on `globalThis.__NF_FEDERATION_STATUS__` for use as a readiness probe:
  ```ts
  interface FederationStatus {
    ok: boolean;            // true iff every required remote registered
    initialized: string[];  // remotes that registered at startup
    missing: string[];      // expected-but-unregistered remotes
    error?: string;         // init-level failure, if init rejected outright
  }
  ```
- Honors `NF_REQUIRE_REMOTES` (see [Environment variables](#env)) — `process.exit(1)` when a required remote is missing, so a platform supervisor restarts the host instead of serving empty regions.

## <a id="dev"></a> Dev SSR (`ng serve`)

`--import` is impossible under `ng serve` (there's no Node launch command), so dev uses a different mechanism for the same ordering guarantee: an esbuild `inject` + externalize of the orchestrator's `/node` entry, so the loader hook fires inside Vite's SSR graph.

- The server-side loader is published **synchronously** at module-eval, but `initNodeFederation` runs **lazily on the first remote load**, once, memoised — bounded by `NF_DEV_SSR_INIT_TIMEOUT_MS` (default 10 s).
- Dev capture uses `hostInstances: { load: (s) => import(s) }` so singletons are captured through the host realm (Vite's SSR graph), not the orchestrator's.
- Dev publishes **no** `__NF_FEDERATION_STATUS__` (only the prod `--import` preload does) and init is lazy, so there is no eager readiness — `/healthz` is **prod-only** and returns 503 in dev.

> Because dev init is lazy and memoised, a mis-ordered dev host doesn't render empty and then heal — it renders the `RemoteUnavailable` placeholder and stays that way until the dev server is **restarted** (a file save won't re-init). Gate dev startup on the remotes' `remoteEntry.json` (see [Boot order](#boot-order)).

## <a id="wiring"></a> Wiring the loader into Angular

The router needs one call — `loadRemote(remoteName, exposedModule)` — that works in both the browser and on the server. The implementation differs per platform, so it lives behind an injection token:

```ts
// load-remote-module.token.ts
export const LOAD_REMOTE_MODULE = new InjectionToken<LoadRemoteModule>('LOAD_REMOTE_MODULE');
export const SERVER_LOADER_GLOBAL_KEY = '__NF_HOST_SERVER_LOADER__';
```

```ts
// app.config.ts (browser): the adapter's import-map-based loadRemoteModule
{ provide: LOAD_REMOTE_MODULE,
  useValue: (remoteName, exposedModule) => loadRemoteModule({ remoteName, exposedModule }) }
```

```ts
// app.config.server.ts (server): read the loader the preload published on the global slot
const serverLoader = (remoteName, exposedModule) => {
  const loader = globalThis[SERVER_LOADER_GLOBAL_KEY];   // set by node-preload
  if (!loader) throw new Error('server federation loader not initialized …');
  return loader(remoteName, exposedModule);
};
{ provide: LOAD_REMOTE_MODULE, useValue: serverLoader }
```

The token is read **synchronously** in routes (so you stay inside Angular's injection context), but the actual call is deferred onto a microtask. The *server* loader throws **synchronously** if federation isn't initialised yet; deferring turns that synchronous throw into a catchable rejection, so a route can fall back to a placeholder instead of crashing the whole render:

```ts
function loadRemote(remoteName: string, exposedModule: string): Promise<unknown> {
  const load = inject(LOAD_REMOTE_MODULE);      // capture synchronously
  return Promise.resolve().then(() => load(remoteName, exposedModule));   // defer the call
}
```

## <a id="routes"></a> Federated routes under SSR

Angular's SSR build derives a **route manifest** by *statically crawling* the host's router config at build time, and `AngularNodeAppEngine` only server-renders URLs present in that manifest.

A federated **`loadChildren`** callback cannot be resolved during that build-time crawl (the server federation loader isn't initialised then), so its child routes — e.g. `/todos/:id` — **never enter the manifest**. Symptom: `/todos` renders, client-side navigation to `/todos/:id` works, but a **direct** request to `/todos/:id` returns a **404 from Express**. (This is about discovering the route *shape*, not enumerating ids — a server-rendered `:id` is stored as a single wildcard pattern, so once the shape is known any id renders on demand.)

**The fix: host owns the route shape.** Mount the feature with **`loadComponent` children** instead of a federated `loadChildren`:

```ts
{
  path: 'todos',
  children: [
    { path: '',    loadComponent: () => loadRemote('mfe1', './List')
        .then(m => m as Type<unknown>).catch(() => RemoteUnavailable) },
    { path: ':id', loadComponent: () => loadRemote('mfe1', './Detail')
        .then(m => m as Type<unknown>).catch(() => RemoteUnavailable) },
  ],
}
```

A `loadComponent` path is registered statically (its callback isn't invoked at build time), so both `/todos` and `/todos/:id` land in the manifest and server-render on direct request. The remote owns the **components**; the host owns the **route shape**; `:id` binds to the detail component via `withComponentInputBinding()`. **Trade-off:** adding a nested child later requires a host change.

> **Long-term alternative (not yet shipped).** Keep the federated `loadChildren` (remote owns its routes) and make the child routes visible to the build via a **manifest merge**: each remote already emits its own `angular-app-manifest.mjs`; a post-build step reads it, prefixes the routes (`/` → `/todos`, `/*` → `/todos/*`), and merges them into the host manifest — avoiding both hooking Angular's route extraction and executing remote code at build time. This belongs upstream in the adapter.

## <a id="boot-order"></a> Boot order

The host's federation init **fetches each remote's `remoteEntry.json` over HTTP once, at start-up, and never re-fetches**. Therefore **remotes must be listening before the host boots.** If the host starts first it can't reach the remotes, those remotes are skipped (`strictRemoteEntry` defaults to `false`), and their regions render empty **for the lifetime of the host process**, until it is restarted.

In the example a launcher enforces it: [`scripts/start-all.mjs`](https://github.com/native-federation/playground/tree/main/angular/ssr) (prod) and `scripts/start-dev.mjs` (dev) start the remotes, **wait for each `remoteEntry.json` to respond**, then start the host. `Ctrl+C` (or any child crashing) tears everything down together. The remote ports are pinned by the host's `federation.manifest.json`; if you start a remote on a different port, update the manifest to match.

In production, explicit ordering can instead be **replaced** by `NF_REQUIRE_REMOTES` + a restart-on-exit supervisor (k8s, PM2, systemd): the host boots too early → required remote missing → `process.exit(1)` → the supervisor restarts it → it converges once the remotes are up. Note this needs the **exit** gate — a `/healthz` probe *without* `NF_REQUIRE_REMOTES` keeps an unhealthy host out of rotation but never recovers it (there is no in-process re-init), so it stays down until manually restarted.

## <a id="externals"></a> Externals on the server

On the browser side, externals are excluded from the Angular bundle by an esbuild plugin the adapter installs. That plugin is bypassed for SSR builds, so the adapter instead sets `options.externalDependencies = externals` on the underlying Angular target. The result is the same — Angular doesn't pre-bundle anything Native Federation will load at runtime — but uses Angular's first-class hook, leaving `@angular/*` etc. as real `import` statements to shared chunks.

One consequence: `@angular/core` infers `ngServerMode` from the bundling step. Because Native Federation reuses the _same_ shared `@angular/core` bundle on the server and in the browser, the adapter patches `node_modules/@angular/core/fesm2022/core.mjs` with a small runtime check:

```js
if (typeof globalThis.ngServerMode === 'undefined')
  globalThis.ngServerMode = (typeof window === 'undefined') ? true : false;
```

The patch is applied automatically by the adapter on every build. Treat it as an implementation detail.

## <a id="manifest"></a> Manifests & CORS

- **Same manifest, both worlds.** Use the same `federation.manifest.json` for browser and Node. The preload reads it from the app's browser output dir, so they stay in sync.
- **Production URLs.** If your remotes are deployed across origins, list absolute URLs in the manifest. The Node side will fetch `remoteEntry.json` from those URLs; make sure they're reachable from your SSR runtime.
- **CORS.** The schematic enables `cors` on the generated Express app so cross-origin requests don't bounce. Adjust the policy in `server.ts` if you need stricter rules.
- **I18N.** When SSR runs alongside multiple locales, the dev server only serves _one_ locale at a time (Angular's limitation). Production builds emit one folder per locale; route accordingly. See [I18N](i18n.md).

## <a id="env"></a> Environment variables

- `PORT` — server listen port (per `server.ts`).
- `NF_BROWSER_DIR` — override for the preload when the `server` and `browser` dirs aren't `../`-adjacent (custom output layout, containers that relocate one of them).
- `NF_REQUIRE_REMOTES` — strict readiness gate for the preload (default off). `all` requires every manifest remote; a comma list (`mfe1,mfe2`) requires a subset. If a required remote didn't register at boot, the preload `process.exit(1)`s.
- `NF_DEV_SSR_INIT_TIMEOUT_MS` — bound on the lazy dev init (default `10000`).

## Related

- [Orchestrator — Node.js / SSR](../orchestrator/node.md) — `initNodeFederation`, the `module.register()` loader hook, and host-singleton bridging.
- [Native Federation Angular SSR example](https://github.com/native-federation/playground/tree/main/angular/ssr) — the full host + two-remote workspace this page describes.
- [Runtime overview](../runtime/index.md).
- [SSR & Hydration with Native Federation for Angular](https://www.angulararchitects.io/blog/ssr-and-hydration-with-native-federation-for-angular/) — the long-form article behind these features.
