---
applies_to: [v3, v4]
---

# Orchestrator

> A runtime micro-frontend orchestrator that loads Native Federation remotes into any web page, with advanced dependency resolution and cross-reload caching.

> **Note:** **Fully compatible with v3 and v4.**
> The orchestrator package ships with Native Federation v4, but v3 and v4 share the same runtime contract (`remoteEntry.json`), so it loads v3 and v4 remotes side by side.

The Orchestrator — `@softarc/native-federation-orchestrator` — is the next-generation browser runtime for Native Federation. It replaces the default [Runtime](../runtime/index.md) (`@softarc/native-federation-runtime`) as the recommended way to load remotes on the host, whether the host is a SPA, a plain HTML page, or a server-rendered application (PHP, Rails, Java, …).

## What makes it different

Compared to the classic runtime, the orchestrator adds three things:

- **Semver-aware version resolution.** When remotes disagree on a shared dependency version, the orchestrator picks the most compatible version per share-scope and falls back to scoped downloads only when it has to. See [Version Resolver](version-resolver.md).
- **Cross-reload caching.** Resolved `remoteEntry.json` metadata and shared externals can be persisted in `sessionStorage` or `localStorage`, so server-rendered hosts that refresh on every navigation don't re-download what the browser already has.
- **A zero-setup quickstart bundle.** For HTML-only hosts, a single `<script>` tag reads a manifest out of the DOM and wires everything up — no npm install, no build step.

The orchestrator stays fully compatible with the Native Federation ecosystem — any remote built with `@softarc/native-federation` (v3 or v4) that emits a standard `remoteEntry.json` can be loaded by it.

## SSR today

The Orchestrator runs in the browser. A server-rendered host still works — the Orchestrator loads the remotes client-side after the page arrives — but if you need remote modules to execute during SSR itself, stick with the default [Runtime](../runtime/index.md) for now. See [SSR & Hydration](../ssr-hydration.md) for the full picture.

> **Note:** New to Native Federation? Start with the [Architecture Overview](../architecture.md) and [Mental Model](../mental-model.md). For a focused comparison between the Orchestrator and the Classic Runtime — when to use which, semver resolution, caching — see [v3 vs v4](../v3-vs-v4.md).

## In this section

- [Getting Started](getting-started.md) — the quickstart bundle, the event registry, and writing your own orchestrator script.
- [Architecture](architecture.md) — the manifest, `remoteEntry.json`, the internal caches, and how the final import map is built.
- [Configuration](configuration.md) — the full `initFederation` options reference: host entry, import-map implementation, logging, modes and storage.
- [Version Resolver](version-resolver.md) — how shared dependencies are resolved across scopes, the `shareScope` mechanism, the strict scope, and dynamic init.

## Example repositories

- [Vanilla JS/HTML host](https://github.com/Aukevanoost/native-federation-examples/tree/orchestrator) — the orchestrator inside a plain HTML page.
- [Angular host (v3)](https://github.com/Aukevanoost/native-federation-examples-ng) — the orchestrator inside an Angular monorepo using Native Federation v3.
- [Angular host (v4)](https://github.com/Aukevanoost/native-federation-examples-ng/tree/v4) — same, using Native Federation v4.
