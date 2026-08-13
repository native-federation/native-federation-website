# Orchestrator

> The v4 host runtime, used as an opt-in on v3 — semver-aware version resolution, cross-reload caching and a drop-in bundle for HTML-only hosts.

`@softarc/native-federation-orchestrator` is the browser runtime that ships with Native Federation **v4**. On the v3 line the default runtime is the [classic runtime](../runtime/index.md) — but the orchestrator reads the same `remoteEntry.json` contract, so a v3 host can opt into it without rebuilding its remotes.

This page covers what that buys you and what it costs. The full reference lives in the v4 docs; every link below points there.

## When it is worth opting in

The v3 runtime deduplicates a shared dependency only when two remotes declare a byte-identical `version`. Everything else gets its own copy under its own scope. Opt into the orchestrator when that is the problem you have:

- **Remotes disagree on versions.** The orchestrator compares the declared semver ranges and elects one version per package instead of shipping several. See [Version Resolver](/docs/v4/orchestrator/version-resolver/).
- **Repeat visits re-fetch every manifest.** The v3 runtime holds its registry in memory only, so a full page load starts from zero. The orchestrator can persist resolved metadata in `sessionStorage` or `localStorage` — this matters most for server-rendered hosts that reload on every navigation. See [Configuration → Storage](/docs/v4/orchestrator/configuration/#storage).
- **The host is not a SPA.** A single `<script>` tag plus a manifest in the DOM wires up a plain HTML page — no npm install, no bundler. See [Getting Started](/docs/v4/orchestrator/getting-started/).
- **You need a CSP-friendly runtime with SRI.** Both DOM sinks go through a vetted Trusted Types policy, and artifacts can be pinned against hashes. See [Security & SRI](/docs/v4/orchestrator/security/).

If none of those apply, the v3 runtime is the simpler choice and is what the Angular adapter wires up for you.

## What v3 remotes cannot use

A v3 build emits a subset of what v4 emits. The optional fields v4 added — `$version`, `chunks`, `integrity`, and the per-dependency `shareScope` and `pool` tags — are simply absent from a v3 `remoteEntry.json`. The orchestrator accepts that input, but the features driven by those fields have nothing to act on:

| Feature | On v3-built remotes |
| --- | --- |
| Semver-range resolution | Works — driven by `packageName`, `version`, `requiredVersion`, `singleton` and `strictVersion`, all of which v3 emits. |
| Persistent caching | Works — it caches the fetched `remoteEntry.json` regardless of which major produced it. |
| [Share scopes](/docs/v4/orchestrator/version-resolver/#share-scopes) | Not available — the scope is declared per shared dependency at build time, so every v3 dependency lands in the global scope. |
| [Dependency pooling](/docs/v4/orchestrator/pooling/) | Limited — build-declared pool tags are absent. |
| Module-level [SRI](/docs/v4/orchestrator/security/#subresource-integrity) | Not available from the build — a v3 `remoteEntry.json` carries no `integrity` map. You can still pin the manifest and each `remoteEntry.json` by hand. |
| [Node.js / SSR execution](/docs/v4/orchestrator/node/) | Browser-only on the v3 line. A server-rendered host works, but its remotes load client-side after the page arrives. |

## Adopting it on a v3 host

The orchestrator replaces the runtime import in your bootstrap; the build side does not change.

```
npm i @softarc/native-federation-orchestrator
```

```ts
// src/main.ts — was: import { initFederation } from '@softarc/native-federation-runtime';
import { initFederation } from '@softarc/native-federation-orchestrator';

initFederation('/assets/federation.manifest.json')
  .then(({ loadRemoteModule }) => import('./bootstrap').then(m => m.bootstrap(loadRemoteModule)))
  .catch(err => console.error(err));
```

The shapes differ in one way that matters: the orchestrator's `initFederation` resolves to an object carrying `loadRemoteModule`, rather than exposing a module-level function that reads global state. Thread that loader through your app instead of importing it. The full option set — logger, storage, modes, import-map implementation — is in [Configuration](/docs/v4/orchestrator/configuration/).

On Angular, keep using the v3 adapter for the build and swap only the runtime call in `main.ts`. The adapter's own runtime re-exports are the classic runtime's, so import the orchestrator directly rather than from `@angular-architects/native-federation`.

## Full reference

The orchestrator's documentation lives in the v4 tree:

| Page | What it covers |
| --- | --- |
| [Getting Started](/docs/v4/orchestrator/getting-started/) | The quickstart bundle, the event registry, writing your own init script. |
| [Architecture](/docs/v4/orchestrator/architecture/) | The manifest, the internal caches, how the import map is built. |
| [Configuration](/docs/v4/orchestrator/configuration/) | Every `initFederation` option. |
| [Version Resolver](/docs/v4/orchestrator/version-resolver/) | Resolution across scopes, the strict scope, dynamic init. |
| [Dependency Pooling](/docs/v4/orchestrator/pooling/) | Keeping a coupled package family assembled from one build. |
| [Event Registry](/docs/v4/orchestrator/event-registry/) | `window.__NF_REGISTRY__` — race-free init, cross-MFE resources. |
| [Module Federation](/docs/v4/orchestrator/module-federation/) | `createGetShared`, the bridge to webpack MF's `shared` config. |
| [Security & SRI](/docs/v4/orchestrator/security/) | CSP setup for the Trusted Types policy and the SRI trust chain. |

## Example repositories

- [Angular host (v3)](https://github.com/Aukevanoost/native-federation-examples-ng) — the orchestrator inside an Angular monorepo using Native Federation v3.
- [Vanilla JS/HTML host](https://github.com/Aukevanoost/native-federation-examples/tree/orchestrator) — the orchestrator inside a plain HTML page.
- [Angular host (v4)](https://github.com/Aukevanoost/native-federation-examples-ng/tree/v4) — the same Angular setup on v4.

Moving the whole stack rather than just the runtime? See [Migration to v4](/docs/v4/migration/).
