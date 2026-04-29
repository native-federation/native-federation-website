# The Mental Model

> Understand the core mental model behind Native Federation — hosts, remotes, shared dependencies, and version mismatch handling for Micro Frontend architectures.

Native Federation inherits the proven Module Federation model — host, remote, shared — and re-expresses it on top of plain ESM and Import Maps. This page is about the *why*: what problem each concept solves and how the pieces fit together at runtime. For precise definitions of every term used below, see [Terminology](terminology.md).

## Runtime Integration, Not Build-Time Coupling

Traditional lazy loading stitches every async boundary at build time — the bundler needs to know, up front, which chunks might show up later. Federation flips that: the host loads code it has never seen during compilation. A separately built, separately deployed remote can be wired in at runtime, so teams keep their own release cadence without needing to rebuild anyone else's bundle.

That single shift is what enables Micro Frontends *and* plugin-style extensions. Everything else in the mental model follows from it.

## Why Import Maps Are the Natural Fit

If the host must resolve a remote's `import '@angular/core'` at runtime — with no help from the bundler — the browser needs a standard way to be told "when you see this specifier, fetch from this URL." That's exactly what an [Import Map](https://html.spec.whatwg.org/multipage/webappapis.html#import-maps) does.

So the build step collects, per project, two artifacts: an `importmap.json` (this project's view of where its externals live) and a `remoteEntry.json` (what this project publishes and expects). At startup the runtime reads each listed remote's `remoteEntry.json`, merges the maps, resolves version conflicts, and injects a single import map into the document. From that point on the browser itself resolves every subsequent `import` — no bundler, no custom module loader.

That's also why Native Federation is not tied to a specific bundler: Import Maps are a browser feature, not a webpack feature.

## Sharing Is Always a Negotiation

If the host needs Angular 20.1.4 and a remote says it wants Angular 20.1.2, somebody has to decide which copy actually loads. That negotiation — "here is what I expect, here is what I can tolerate" — is what the flags on a shared dependency describe:

- **`version`** — The exact version that the remote shares.
- **`requiredVersion`** — Define the semver range that satisfies the remote. Good enough for most libraries.
- **`strictVersion`** — fail fast if no compatible version exists, instead of silently running against something slightly incompatible.
- **`singleton`** — guarantee exactly one instance loads (for all compatible remotes). Could come in handy for libraries with internal state (Angular, `zone.js`, state stores).

Version negotiation is the part most people discover the hard way, so it's worth internalizing up front: "shared" doesn't mean "the same version everywhere." It means "the federation runtime picks one copy that everyone agrees to use."

## How the Pieces Line Up at Runtime

1. Each project builds and publishes its `remoteEntry.json` + shared bundles to a URL.
2. The host's manifest lists those URLs. The [runtime](runtime/index.md) (or [orchestrator](orchestrator/index.md)) fetches each one at startup.
3. It merges the shared-dependency declarations, resolves version conflicts using the flags above, and injects the combined import map.
4. When the user hits a route backed by a remote, `loadRemoteModule` triggers a plain dynamic `import()` — resolved through the injected map.

That's the whole runtime story. The [Architecture Overview](architecture.md) maps these steps to the layers that implement them.

## Further Reading

- [Terminology](terminology.md) — precise definitions of host, remote, shared, singleton, `remoteEntry.json`, manifest, share scope, and more.
- [Native & Module Federation](native-and-module-federation.md) — how the two implementations relate.
