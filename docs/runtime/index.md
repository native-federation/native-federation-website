---
applies_to: [v3, v4]
---

# Runtime

> The Native Federation Runtime — the classic browser-side library that reads remoteEntry.json files, builds an import map, and loads remote modules on demand.

The runtime — `@softarc/native-federation-runtime` — is the small browser-side library that reads `remoteEntry.json` files, constructs an ES module import map, injects it into the DOM, and resolves `loadRemoteModule()` calls against it. It is the classic Native Federation runtime: one version of each shared dependency, wired up on startup, and loaded on demand.

> **Warning:** **Classic runtime — not the default in v4.**
> This runtime is the default runtime in Native Federation **v3** and is what `@angular-architects/native-federation` re-exports out of the box. It is the _legacy_ runtime going forward: in **v4** the recommended browser runtime is the new [Orchestrator](../orchestrator/index.md) (`@softarc/native-federation-orchestrator`), which adds semver-range resolution, persistent caching and share scopes on top of the same `remoteEntry.json` contract.
>
> The classic runtime is still supported — and still the right choice when you need raw simplicity, SSR compatibility on the host, or a drop-in v3 behaviour. If you are starting a new v4 project, prefer the Orchestrator.

## What the Runtime Does

Given a list of remotes (or a manifest URL that resolves to one), the runtime:

- Loads the host's own `remoteEntry.json` and registers its shared dependencies at the root of the import map.
- Fetches each remote's `remoteEntry.json` in parallel and registers:
  - the remote's **exposed modules** as root imports keyed by `<remoteName>/<exposedKey>`;
  - the remote's **shared dependencies** under a **scope** keyed by the remote's base URL.
- Merges everything into a single import map and injects it as a `<script type="importmap-shim">` into `document.head` — so it needs [es-module-shims](https://github.com/guybedford/es-module-shims) in the page.
- Exposes a `loadRemoteModule()` helper that performs a dynamic `import()` (through `importShim`) against that import map.
- Optionally opens a Server-Sent Events connection to a remote's `buildNotificationsEndpoint` to reload the page when the remote rebuilds (dev only).

## What the Runtime Does _Not_ Do

The classic runtime is deliberately thin. Things that are **not** handled here (and are reasons to reach for the [Orchestrator](../orchestrator/index.md) in v4):

- **No semver-range resolution.** Each shared dependency gets one URL per _scope_. If two remotes share different versions of `rxjs` they simply each keep their own — the runtime does not compare ranges or pick a common version. The first URL registered under a given `packageName@version` wins for the external lookup (see [Externals registry](import-map.md#externals)).
- **No share scopes.** There is a single implicit scope per remote base URL; there is no `shareScope` concept.
- **No persistent caching.** Every page load re-fetches every `remoteEntry.json`. You can append a query string via [`cacheTag`](init-federation.md#cache-tag) for cache-busting, but there is no `localStorage`/`sessionStorage` layer.
- **No pluggable storage or logger.** Errors go to `console.error`; state lives on `globalThis.__NATIVE_FEDERATION__`.

If any of those matter to you, look at the [Orchestrator](../orchestrator/index.md).

## Where It Fits

The runtime is the consumer of the artifacts that [Core](../core/index.md) emits. The contract between build and runtime is the [`remoteEntry.json`](../core/artifacts.md) file — the runtime does not care which bundler produced it. For how the runtime relates to the other layers, see the [Architecture Overview](../architecture.md).

## In this section

- [Getting Started](getting-started.md) — install the package, add `es-module-shims`, split your bootstrap.
- [`initFederation`](init-federation.md) — how the host sets federation up: manifest vs. inline map, cache busting, error handling.
- [`loadRemoteModule`](load-remote-module.md) — both call signatures, lazy remote registration and fallbacks.
- [The Import Map](import-map.md) — how imports and scopes are constructed, how externals are deduplicated, `importmap-shim`, and Trusted Types.
- [API Reference](api-reference.md) — the complete public surface of `@softarc/native-federation-runtime`.

> **Note:** If you are an Angular user, you will normally consume the runtime through `@angular-architects/native-federation`, which re-exports `initFederation` and `loadRemoteModule` unchanged. See [Angular Adapter → Runtime](../angular-adapter/runtime.md) for the Angular-specific bootstrap split.
