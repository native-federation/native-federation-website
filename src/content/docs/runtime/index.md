---
applies_to: [v3, v4]
deprecated: true
---

# Legacy Runtime

> The Native Federation Runtime — the classic browser-side library that reads remoteEntry.json files, builds an import map, and loads remote modules on demand.

The runtime — `@softarc/native-federation-runtime` — is the small browser-side library that reads `remoteEntry.json` files, constructs an ES module import map, injects it into the DOM, and resolves `loadRemoteModule()` calls against it. It is the classic Native Federation runtime: one version of each shared dependency, wired up on startup, and loaded on demand.

> **Warning:** **Deprecated — end-of-life.**
> This runtime is the default runtime in Native Federation **v3** and is what `@angular-architects/native-federation` v3 re-exports out of the box. A v4 line was published up to `4.1.2`, but the package is now marked deprecated on npm: _"This package has reached end-of-life and is no longer maintained. Please switch over to the `@softarc/native-federation-orchestrator` library."_
>
> The [Orchestrator](../orchestrator/index.md) is the replacement — it speaks the same `remoteEntry.json` contract and adds semver-range resolution, persistent caching and share scopes. Existing installs keep working, but expect no further fixes or features. See [Migration to v4](../migration.md) for moving a host across; these pages remain for reference.

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

> **Note:** On **v3**, Angular users consume this runtime through `@angular-architects/native-federation`, which re-exports `initFederation` and `loadRemoteModule` unchanged. On **v4** the adapter bridges to the Orchestrator instead — see [Angular Adapter → Runtime](../angular-adapter/runtime.md).
