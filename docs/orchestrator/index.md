---
applies_to: [v3, v4]
---

# Orchestrator

> A runtime micro-frontend orchestrator that loads Native Federation remotes into any web page, with advanced dependency resolution and cross-reload caching.

> **Note:** **Fully compatible with v3 and v4.**
> The orchestrator package ships with Native Federation v4, but v3 and v4 share the same runtime contract (`remoteEntry.json`), so it loads v3 and v4 remotes side by side.

The Orchestrator — `@softarc/native-federation-orchestrator` — is the next-generation browser runtime for Native Federation. It replaces the default [Runtime](../runtime/index.md) (`@softarc/native-federation-runtime`) as the recommended way to load remotes on the host, whether the host is a SPA, a plain HTML page, or a server-rendered application (PHP, Rails, Java, …).

## What makes it different

Compared to the classic runtime, the orchestrator adds five things:

- **Semver-aware version resolution.** When remotes disagree on a shared dependency version, the orchestrator picks the most compatible version per share-scope and falls back to scoped downloads only when it has to. See [Version Resolver](version-resolver.md).
- **Cross-reload caching.** Resolved `remoteEntry.json` metadata and shared externals can be persisted in `sessionStorage` or `localStorage`, so server-rendered hosts that refresh on every navigation don't re-download what the browser already has.
- **A zero-setup quickstart bundle.** For HTML-only hosts, a single `<script>` tag reads a manifest out of the DOM and wires everything up — no npm install, no build step.
- **Built-in Trusted Types & SRI.** The two DOM sinks (the injected `<script type="importmap">` and the dynamic `import()`) flow through a vetted Trusted Types policy, and every artifact the orchestrator touches — the manifest, every `remoteEntry.json`, every JavaScript module — can be pinned against an SRI hash. See [Security](security.md).
- **Server-side orchestration.** The same pipeline runs in Node through `@softarc/native-federation-orchestrator/node`, so SSR / edge-render hosts use the same version resolver, SRI verification and dynamic-init flow as the browser. See [Node.js / SSR](node.md).

The orchestrator stays fully compatible with the Native Federation ecosystem — any remote built with `@softarc/native-federation` (v3 or v4) that emits a standard `remoteEntry.json` can be loaded by it.

## SSR

On **v4** the Orchestrator runs server-side too, so remote modules **execute during SSR itself** — not just client-side after the page arrives. The [`/node` entry](node.md) installs a `module.register()` loader hook and bridges the host's shared singletons (`hostInstances`) so a remote's `@angular/core` resolves to the host's single instance. For Angular, the adapter's `node-preload` wires this for you — see [Angular Adapter → SSR & Hydration](../angular-adapter/ssr.md). For the general picture see [SSR & Hydration](../ssr-hydration.md).

> On v3 the Orchestrator was browser-only; a server-rendered host worked but loaded its remotes client-side after the page arrived. True SSR execution is a v4 capability via the `/node` entry.

> **Note:** New to Native Federation? Start with the [Architecture Overview](../architecture.md) and [Mental Model](../mental-model.md). For a focused comparison between the Orchestrator and the Classic Runtime — when to use which, semver resolution, caching — see [v3 vs v4](../v3-vs-v4.md).

## In this section

- [Getting Started](getting-started.md) — the quickstart bundle, the event registry, and writing your own orchestrator script.
- [Architecture](architecture.md) — the manifest, `remoteEntry.json`, the internal caches, and how the final import map is built.
- [Configuration](configuration.md) — the full `initFederation` options reference: host entry, import-map implementation, logging, modes and storage.
- [Version Resolver](version-resolver.md) — how shared dependencies are resolved across scopes, the `shareScope` mechanism, the strict scope, and dynamic init.
- [Event Registry](event-registry.md) — the `window.__NF_REGISTRY__` event bus: race-free init, cross-MFE resources, and event streams.
- [Node.js / SSR](node.md) — `initNodeFederation`, the `module.register()` loader hook, and migration from `@softarc/native-federation-node`.
- [Security & Subresource Integrity](security.md) — CSP setup for the built-in Trusted Types policy and the SRI trust chain (manifest → `remoteEntry.json` → modules).

## Example repositories

- [Vanilla JS/HTML host](https://github.com/Aukevanoost/native-federation-examples/tree/orchestrator) — the orchestrator inside a plain HTML page.
- [Angular host (v3)](https://github.com/Aukevanoost/native-federation-examples-ng) — the orchestrator inside an Angular monorepo using Native Federation v3.
- [Angular host (v4)](https://github.com/Aukevanoost/native-federation-examples-ng/tree/v4) — same, using Native Federation v4.
