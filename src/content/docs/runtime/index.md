---
applies_to: [v3, v4]
deprecated: true
---

# Legacy Runtime

> The classic @softarc/native-federation-runtime — end-of-life, replaced by the Orchestrator.

`@softarc/native-federation-runtime` was the original browser-side library: it read `remoteEntry.json` files, merged them into one ES module import map, injected it into the DOM, and resolved `loadRemoteModule()` calls against it. One version of each shared dependency, wired up on startup.

> **Warning:** **Deprecated — end-of-life.**
> This was the default runtime in Native Federation **v3**. A v4 line was published up to `4.1.2`, but the package is now marked deprecated on npm: _"This package has reached end-of-life and is no longer maintained. Please switch over to the `@softarc/native-federation-orchestrator` library."_
>
> The [Orchestrator](../orchestrator/index.md) is the replacement, and it is where all runtime documentation now lives. It speaks the same `remoteEntry.json` contract, so migrating a host is mostly a matter of swapping the import and threading the resolved loader through your app — see [Migration to v4](../migration.md).
>
> The former deep-dive pages for this package (`initFederation`, `loadRemoteModule`, the import map, and the API reference) have been removed to avoid confusion with the Orchestrator's very similar — but not identical — API. For v3 hosts still on this package, the [`v3` branch of the README](https://www.npmjs.com/package/@softarc/native-federation-runtime) remains the reference.

## Why the Orchestrator Replaced It

The classic runtime was deliberately thin. Each of these gaps is a reason it was superseded:

| Gap | How the Orchestrator handles it |
| --- | --- |
| **No semver-range resolution.** Each shared dependency got one URL per scope; two remotes wanting different `rxjs` versions simply each kept their own. | Compares declared ranges and elects one version per scope — see [Version Resolver](../orchestrator/version-resolver.md). |
| **No share scopes.** A single implicit scope per remote base URL. | Global, named, and strict [share scopes](../orchestrator/version-resolver.md#share-scopes). |
| **No persistent caching.** Every page load re-fetched every `remoteEntry.json`. | Pluggable [storage](../orchestrator/configuration.md#storage) — `sessionStorage` / `localStorage` survive navigation and reloads. |
| **No pluggable storage or logger.** Errors went to `console.error`; state lived on `globalThis.__NATIVE_FEDERATION__`. | Configurable [logger](../orchestrator/configuration.md#logging) and storage handles. |
| **No dynamic init.** Remotes had to be known up front, apart from a `remoteEntry`-based one-off load. | [`initRemoteEntry`](../orchestrator/version-resolver.md#dynamic-init) adds remotes after startup, additively. |

## Where to Go Instead

- [Orchestrator → Getting Started](../orchestrator/getting-started.md) — install, embed, and load your first remote module.
- [Orchestrator → Configuration](../orchestrator/configuration.md) — host config, import-map implementation, logging, modes, storage.
- [Angular Adapter → Runtime (v3)](../angular-adapter/runtime-v3.md) — this package as Angular hosts consumed it; the v3 adapter was a plain `export * from` of it.
- [Angular Adapter → Runtime (v4)](../angular-adapter/runtime.md) — the current Angular bootstrap split, `initFederation`, and dynamic remotes.
- [Migration to v4](../migration.md) — moving a host across.
