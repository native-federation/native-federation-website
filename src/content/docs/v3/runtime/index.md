# Runtime

> @softarc/native-federation-runtime — the browser-side library that reads remoteEntry.json files, merges them into one import map, and resolves loadRemoteModule() calls against it.

`@softarc/native-federation-runtime` is the host-side half of Native Federation v3. The [core builder](../core/index.md) writes a `remoteEntry.json` per application; the runtime reads them in the browser, merges them into a single ES module import map, injects it into the DOM, and resolves `loadRemoteModule()` calls against it.

It is deliberately small. Two functions cover the common case:

```ts
import { initFederation, loadRemoteModule } from '@softarc/native-federation-runtime';

// once, before the app bootstraps
await initFederation({ mfe1: 'http://localhost:3001/remoteEntry.json' });

// wherever a remote is needed
const { AppComponent } = await loadRemoteModule('mfe1', './Component');
```

Angular projects get the same surface from `@angular-architects/native-federation`, whose main entry is a single `export * from '@softarc/native-federation-runtime'` — see [Angular Adapter → Runtime](../angular-adapter/runtime.md).

## What it does at startup

1. Fetches the host's own `remoteEntry.json` and turns its `shared[]` into root-level import-map entries.
2. Fetches every configured remote's `remoteEntry.json` in parallel, adding each remote's exposed modules to the root imports and its shared deps to a scope keyed by the remote's base URL.
3. Deduplicates shared dependencies through an in-memory externals registry keyed by `packageName@version` — an exact match, not a semver range.
4. Injects the merged map as `<script type="importmap-shim">`, behind a Trusted Types policy when the page enforces one.

State lives on `globalThis.__NATIVE_FEDERATION__` — the externals registry plus two maps of registered remotes. Because it hangs off the global object, a second copy of the runtime on the same page shares the same registries rather than starting over.

## Pages

- [Getting Started](getting-started.md) — install, `es-module-shims`, the bootstrap split, first remote.
- [`initFederation`](init-federation.md) — inline remotes vs manifest, `deployUrl`, `cacheTag`, error behaviour, hot reload.
- [`loadRemoteModule`](load-remote-module.md) — both call forms, lazy registration, fallbacks.
- [The Import Map](import-map.md) — root imports, scopes, the externals registry, Trusted Types.
- [API Reference](api-reference.md) — every export, the global cache, the Module Federation bridge.

## Do you want the orchestrator instead?

`@softarc/native-federation-orchestrator` is the v4 runtime, and it speaks the same `remoteEntry.json` contract — so it can load v3-built remotes. It is an opt-in on the v3 line: worth it if you need semver-range resolution across remotes that disagree on a version, share scopes, or persistent caching of `remoteEntry.json` between page loads. See [Orchestrator](../orchestrator/index.md) for what it adds and how to adopt it, and [Migration to v4](/docs/v4/migration/) if you are moving the whole stack.
