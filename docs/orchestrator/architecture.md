---
applies_to: [v3, v4]
---

# Orchestrator Architecture

> How the Native Federation Orchestrator discovers remotes, caches metadata, resolves shared dependencies and generates the browser's import map.

The orchestrator turns a list of remote URLs into a live import map the browser can resolve. This page walks through the moving parts: the manifest, each `remoteEntry.json`, the internal caches it builds in memory (or persistent storage), and the final import map the browser actually sees.

## The problem, in one paragraph

Host (or shell) applications want to mount micro frontends that other teams build and deploy independently — without downloading their dependencies multiple times. Two teams both needing React shouldn't download React twice, three teams using the same design system shouldn't each ship their own copy, and a legacy app stuck on React 17 shouldn't break the whole page. The orchestrator solves that at runtim on init: it reads everyone's metadata, decides what can be shared and what has to be isolated, and writes a single import map the browser uses to resolve every `import` in every remote.

## Runtime flow

A single `initFederation` call drives the whole lifecycle:

1. **Discover.** Read the manifest (inline object or URL pointing to a JSON manifest) to know which remotes exist. The `quickstart.mjs` bundle additionally reads a manifest out of a `<script type="application/json" id="mfe-manifest">` element before handing it to `initFederation`.
2. **Fetch metadata.** In parallel, fetch each remote's `remoteEntry.json`.
3. **Cache.** Store the parsed exposes and shared externals in the internal caches, keyed by share-scope.
4. **Resolve.** For every shared dependency, pick a winner per scope using the rules described in [Version Resolver](version-resolver.md).
5. **Write the import map.** Commit it to the DOM via `setImportMapFn` — either a native `<script type="importmap">` or the `importmap-shim` form when running under es-module-shims.
6. **Expose loaders.** Resolve the `initFederation` promise with `loadRemoteModule`, `load`, `as`, `config`, `adapters` and `initRemoteEntry`.

Steps 2–5 can happen again after initialization through [dynamic init](version-resolver.md#dynamic-init), but only additively — nothing resolved during the initial pass is ever rewritten.

## Core concepts

### 1. Manifest — the service directory

The manifest maps remote names to `remoteEntry.json` URLs. Nothing else. It's the one piece of configuration your host owns end-to-end.

```json
{
  "shopping-cart":  "https://example.cdn/shopping-cart/1.0.1/remoteEntry.json",
  "user-profile":   "https://example.cdn/user-profile/1.3.2/remoteEntry.json",
  "payment-widget": "https://example.cdn/payment-widget/2.3.1/remoteEntry.json"
}
```

The directory that contains each `remoteEntry.json` becomes that remote's **scope URL**. Every module path and every scoped external is resolved relative to that directory — so publishing a remote at `https://example.org/mfe1/remoteEntry.json` means all of its JS lives under `https://example.org/mfe1/`.

> **Note:** Inline manifests are fine for demos. In production, prefer serving the manifest from a discovery endpoint or feed service so you can roll out, A/B-test or feature-flag remotes without rebuilding the host.

### 2. remoteEntry.json — the component metadata

Every remote publishes one `remoteEntry.json`. It lists the modules the remote exposes and the dependencies the remote wants to share.

```json
{
  "name": "team/remote1",
  "exposes": [
    { "key": "./comp-a", "outFileName": "component-a.js" }
  ],
  "shared": [
    {
      "packageName": "dep-a",
      "outFileName": "dep-a.js",
      "version": "1.2.3",
      "requiredVersion": "~1.2.1",
      "strictVersion": false,
      "singleton": true
    },
    {
      "packageName": "dep-b",
      "outFileName": "dep-b.js",
      "version": "4.5.6",
      "requiredVersion": "^4.1.1",
      "strictVersion": true,
      "singleton": false
    }
  ]
}
```

#### Shared external properties

| Property | Description |
| --- | --- |
| `version` | The actual version this remote ships. |
| `requiredVersion` | The range this remote is willing to accept from a shared copy — the basis for compatibility checks. |
| `strictVersion` | When `true`, the remote refuses incompatible shared versions and gets its own scoped copy instead of a warning. |
| `singleton` | When `true`, the dependency is a candidate for sharing across remotes. When `false`, it is always scoped to this remote. |
| `shareScope` | Group externals into logical clusters; the special `"strict"` scope enables exact-version sharing. See [shareScope](version-resolver.md#share-scopes). |
| `packageName` | The import specifier remotes use (e.g. `'react'`). |
| `outFileName` | File name, relative to the remote's scope URL. |
| `bundle` | Optional name of the shared bundle this external belongs to — the key the orchestrator uses to look up sibling chunk files in the shared-chunks cache (v4 opt-in). |
| `dev` | Optional dev-mode metadata (original source path, etc). |

## Internal caches

After fetching metadata, the orchestrator keeps four caches in memory (and optionally mirrors them to `sessionStorage`/`localStorage`). Everything the resolver and the import-map builder need lives in these structures — they're accessible via `@softarc/native-federation-orchestrator/sdk` if you need to introspect.

### Remote information cache

A plain map of remote name → scope URL + exposed modules:

```json
{
  "shopping-cart": {
    "scopeUrl": "https://ecommerce-team.com/",
    "exposes": [
      { "moduleName": "./CartButton",  "file": "cart-button.js" },
      { "moduleName": "./CartSummary", "file": "cart-summary.js" }
    ]
  }
}
```

This is what `loadRemoteModule('shopping-cart', './CartButton')` reads to compute the final URL.

### Shared externals cache

Dependencies with `singleton: true` become _shared externals_. The cache groups them by `shareScope` (with the special sentinel `__GLOBAL__` for unnamed scopes), then by package name. Each entry is a list of candidate versions, each annotated with a resolved **action**:

```json
{
  "shared-externals": {
    "__GLOBAL__": {
      "dep-a": {
        "dirty": false,
        "versions": [
          {
            "tag": "1.2.3",
            "host": false,
            "action": "share",
            "remotes": [
              { "file": "dep-a.js", "name": "team/mfe1", "requiredVersion": "~1.2.1", "strictVersion": false, "cached": true  },
              { "file": "dep-a.js", "name": "team/mfe2", "requiredVersion": "~1.2.1", "strictVersion": false, "cached": false }
            ]
          },
          {
            "tag": "1.2.2",
            "host": false,
            "action": "skip",
            "remotes": [
              { "file": "dep-a.js", "name": "team/mfe2", "requiredVersion": "^1.2.1", "strictVersion": true, "cached": false }
            ]
          }
        ]
      }
    },
    "custom-scope": {
      "dep-c": { "/* … */": "…" }
    }
  }
}
```

The three possible actions — `share`, `skip`, `scope` — come out of the resolver. The `dirty` flag marks scopes whose version list changed since the last resolution pass; only dirty scopes get re-resolved, which keeps warm reloads fast.

### Scoped externals cache

Dependencies with `singleton: false` are always scoped to their remote. The cache is a simple map `remoteName → packageName → { tag, file, bundle? }`; the import-map builder later joins each `file` to the owning remote's `scopeUrl`:

```json
{
  "scoped-externals": {
    "team/mfe1": {
      "dep-b": { "tag": "4.5.6", "file": "dep-b.js" }
    }
  }
}
```

### Shared chunks cache

> **Note:** **Opt-in, introduced in native-federation v4.**
> Shared chunks are an opt-in feature of Native Federation v4 — remotes built without it simply won't populate this cache, and the orchestrator falls back to loading each shared external as a single file. Before this feature, chunks were added to the shared object as separate externals which was very expensive to calculate.

When a v4 remote opts in, the builder can code-split a shared external — breaking a single package into multiple chunk files. The orchestrator then needs to know the sibling file names so dynamic imports inside that package resolve correctly. The shared chunks cache stores that list, keyed by remote and by the bundle the chunks belong to:

```json
{
  "shared-chunks": {
    "team/mfe1": {
      "browser-shared": ["dep-a.chunk-AAAA.js", "dep-a.chunk-BBBB.js"],
      "angular-core": ["dep-b.chunk-CCCC.js"]
    }
  }
}
```

During import-map generation, these chunk files are added under a dedicated chunk scope so every dynamic `import()` inside a shared bundle lands on the right URL. Most consumers never touch this cache directly — it exists to make opt-in multi-chunk shared externals work transparently.

## The generated import map

All four caches feed into a single import map that the orchestrator commits to the DOM before resolving the init promise:

```json
{
  "imports": {
    // Exposed modules, addressable as "<remoteName>/<key>"
    "shopping-cart/./CartButton":  "https://ecommerce-team.com/cart-button.js",
    "shopping-cart/./CartSummary": "https://ecommerce-team.com/cart-summary.js",

    // Globally shared externals
    "dep-a": "https://example.org/mfe1/dep-a.js"
  },
  "scopes": {
    // Scoped externals — only visible inside one remote
    "https://example.org/mfe1/": {
      "dep-b": "https://example.org/mfe1/dep-b.js",
      "dep-c": "https://example.org/mfe1/dep-c.js",

      // Shared-chunk siblings (v4 opt-in) — resolved inside the remote's scope
      "@nf-internal/chunk-IXOA6WTM": "https://example.org/mfe1/chunk-IXOA6WTM.js",
      "@nf-internal/chunk-WDE5IQ2F": "https://example.org/mfe1/chunk-WDE5IQ2F.js"
    },
    // shareScope grouping — same URL reused across several scopes
    "https://example.org/mfe2/": {
      "dep-c": "https://example.org/mfe1/dep-c.js"
    }
  }
}
```

Four patterns fall out of this structure:

- **Global sharing** via `imports` — one download for every consumer.
- **Scoped isolation** via `scopes` — a specific remote gets its own copy without disturbing anyone else.
- **Scope groups** — the same URL reused in several `scopes` entries. Import maps don't have a first-class "group of scopes" concept, so the orchestrator emulates it by writing the same file under each member scope. From the browser's perspective it's still one download (the URL is identical), but each remote resolves the import inside its own scope.
- **Shared chunks** — when a v4 remote opts into chunked shared externals, each chunk sibling is registered inside the owning remote's scope under an internal specifier (e.g. `@nf-internal/chunk-IXOA6WTM`). Dynamic imports emitted by the bundler inside a shared package then resolve to the right sibling file without polluting the global `imports`.

## Caching & performance

Resolved metadata is worth keeping around. Between page loads, the orchestrator can remember which remotes it already knows about and which shared versions it already picked, so a navigation-triggered reload doesn't re-fetch `remoteEntry.json` files the browser already cached in its HTTP cache.

| Storage | Lifetime | Best for |
| --- | --- | --- |
| **Memory** (`globalThisStorageEntry`, default) | Single page load | SPAs, development, testing |
| **sessionStorage** | Browser session | Multi-page server-rendered hosts — the main use case |
| **localStorage** | Until cleared | Aggressive caching across browser restarts; accept some staleness |

On top of storage choice, the resolver applies four optimization strategies:

- **Skip cached remotes.** If a remote is already in cache with the same `remoteEntry.json` URL, don't refetch. Controlled by `profile.overrideCachedRemotes`.
- **Reuse resolved versions.** Which version was picked for each shared external last time survives the reload.
- **Host wins ties.** A `hostRemoteEntry` always dictates the shared version for its scope.
- **Maximize sharing.** The default resolution strategy picks the version that minimizes extra downloads (see [Optimal Version Strategy](version-resolver.md#optimal)).

Every knob above has a dedicated option on [Configuration](configuration.md).

## A worked example

An e-commerce host with three independently-owned remotes:

```html
<script type="application/json" id="mfe-manifest">
{
  "product-catalog": "https://catalog-team.com/remoteEntry.json",
  "shopping-cart":   "https://cart-team.com/remoteEntry.json",
  "user-account":    "https://account-team.com/remoteEntry.json"
}
</script>
```

What happens:

1. **Manifest processing** — three remotes discovered.
2. **Metadata collection** — three `remoteEntry.json` fetches, executed in parallel.
3. **Dependency resolution** — overlapping React, lodash and shared UI components are unified; incompatible entries fall into scoped downloads.
4. **Import map generation** — one map, committed once before any module loads.
5. **Runtime** — `loadRemoteModule()` calls now resolve synchronously against the import map.

What you get:

- Teams deploy on their own cadence without coordinating releases.
- Shared libraries download once and are reused across remotes.
- The browser HTTP cache keeps warm navigations near-instant.

## Where to go next

- [The orchestrator docs](https://github.com/native-federation/orchestrator/blob/main/docs/architecture.md) — The orchestrator docs regarding native-federation's architecture.
- [Version Resolver](version-resolver.md) — the algorithm behind `share` / `skip` / `scope` decisions.
- [Configuration](configuration.md) — every option that changes the behavior described above.
- [v3 vs v4](../v3-vs-v4.md) — how the orchestrator compares to the classic `@softarc/native-federation-runtime`.
