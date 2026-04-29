---
applies_to: [v3, v4]
---

# The Import Map

> How the classic runtime constructs the browser import map — host root imports, per-remote scopes, externals deduplication, Trusted Types and es-module-shims.

Everything the runtime does — resolving shared dependencies, loading exposed modules, keeping two remotes' `rxjs` apart — is implemented as entries in a single browser import map. This page walks through how that map is built, how it ends up in the DOM, and what the scoping rules actually mean at runtime.

## The shape of the map

The runtime's import map follows the standard browser shape:

```ts
type Imports = Record<string, string>;
type Scopes  = Record<string, Imports>;

interface ImportMap {
  imports: Imports;
  scopes:  Scopes;
}
```

`imports` applies to bare specifiers anywhere on the page. `scopes` applies only when the importing module's URL starts with the scope key. That distinction is what lets two remotes bring their own `rxjs` without stepping on each other.

A typical merged map for a host + two remotes looks roughly like this:

```json
{
  "imports": {
    "@angular/core":   "./angular-core-A9B2.js",
    "rxjs":            "./rxjs-1123.js",
    "mfe1/Component":  "http://localhost:3001/Component-QX77.js",
    "mfe2/Orders":     "http://localhost:3002/Orders-P4A9.js"
  },
  "scopes": {
    "http://localhost:3001/": {
      "@angular/core": "./angular-core-A9B2.js",
      "rxjs":          "http://localhost:3001/rxjs-1123.js"
    },
    "http://localhost:3002/": {
      "@angular/core": "./angular-core-A9B2.js",
      "rxjs":          "http://localhost:3002/rxjs-F802.js"
    }
  }
}
```

## Host contributions — root imports

The host's `remoteEntry.json` is fetched from `./remoteEntry.json` (same origin as the host page). Every `shared[]` entry becomes a root-level import, keyed by package name and pointing at a relative path under the host's bundle directory (default `./`):

```ts
// From processHostInfo
imports[shared.packageName] = relBundlesPath + shared.outFileName;
```

Host shared deps go into _root_ imports rather than a scope because the host loads first and should be the shared-dep baseline for remotes that can reuse its versions. The externals registry ([below](#externals)) is what makes that reuse possible.

## Remote contributions — root imports & scopes

Every remote contributes two things:

- **Exposed modules** go into root imports, keyed by `<remoteName>/<exposedKey>` (for example `mfe1/Component`). That is what makes `loadRemoteModule('mfe1', './Component')` resolve to an absolute URL on the remote's origin.
- **Shared deps** go into a **scope** keyed by the remote's base URL (the directory of its `remoteEntry.json`) with a trailing slash. That scope contains one entry per shared package, pointing at the remote's own bundled copy — unless the externals registry hands back a URL that was already registered (typically the host's).

```ts
// From processRemoteImports
for (const shared of remoteInfo.shared) {
  const outFileName = getExternalUrl(shared) ?? joinPaths(baseUrl, shared.outFileName);
  setExternalUrl(shared, outFileName);
  scopedImports[shared.packageName] = outFileName;
}
scopes[baseUrl + '/'] = scopedImports;
```

Because the scope key is the remote's base URL, browser import-map matching ensures that code loaded _from that remote_ resolves `@angular/core` against the scoped entry, while code loaded from the host uses the root-level entry. Both entries point at URLs — the same one when the externals registry reused an earlier registration.

## Chunks

If the build emitted a `chunks` map in `remoteEntry.json` (shared code split across multiple files), each chunk file is also added to the map. Host chunks go into root imports; remote chunks go into the remote's scope. The key is derived from the chunk's filename via the core's `toChunkImport` helper, so the runtime does not have to invent names itself.

## The externals registry

The runtime maintains a small in-memory registry — a `Map<string, string>` keyed by `<packageName>@<version>`:

```ts
// From externals.ts
function getExternalKey(shared: SharedInfo) {
  return `${shared.packageName}@${shared.version}`;
}
```

When a shared dep is registered, the runtime looks up its `packageName@version` in the registry. If a URL is already there, it reuses that URL; if not, it stores the current remote's URL. That means the _first_ remote to register a given `packageName@version` wins: any subsequent remote with the same `packageName@version` gets pointed at the first remote's copy instead of shipping its own.

This is how the classic runtime deduplicates shared deps: **exact version match on `packageName@version`**. If the versions differ at all — even by a patch — every remote keeps its own copy under its own scope.

> **Warning:** The classic runtime has **no semver-range resolution**. It does not look at `requiredVersion`, it does not compare ranges, it does not pick a common version — the `version` string must be _byte-identical_ for two remotes to share a bundle. Range-aware version selection is what the [Orchestrator](../orchestrator/index.md) adds on top.

The registry lives on `globalThis.__NATIVE_FEDERATION__.externals` along with the remotes registry (`remoteNamesToRemote`, `baseUrlToRemoteNames`). That puts it in the same object that `@angular-architects/module-federation` historically exposed, which matters for the `getShared()` interop helper used when mixing with Module Federation remotes.

## Injection into the DOM

Once `initFederation` has merged the host + remote maps, it injects the result as a script tag at the end of `document.head`:

```ts
document.head.appendChild(
  Object.assign(document.createElement('script'), {
    type:        'importmap-shim',
    textContent: JSON.stringify(importMap),
  }),
);
```

A second call (for example, when `loadRemoteModule` lazily registers a new remote) appends _another_ `importmap-shim` script. The es-module-shims polyfill merges them on the fly, so later entries add to rather than replace earlier ones.

## Trusted Types

If the page enforces [Trusted Types](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API), assigning a plain string to a script tag's `type` or `textContent` would be blocked. The runtime creates a Trusted Types policy named `native-federation` the first time it needs one, and pipes both values through `policy.createScript(...)` before assigning them. If the browser has no Trusted Types, or the policy cannot be created (for example because the name is already registered), the runtime silently falls back to the raw string.

If your CSP restricts `trusted-types`, allow the `native-federation` policy name.

## es-module-shims

The runtime uses the shimmed flavour of the spec (`type="importmap-shim"`, `globalThis.importShim()`) rather than the native one for two reasons:

- **Multiple maps.** Browsers only accept _one_ native `<script type="importmap">` per page, and it must appear before the first module import. The runtime needs to append additional maps as remotes are lazily registered after the page has already started running — which is exactly what es-module-shims allows.
- **Broader compatibility.** Native import maps are well supported today, but the shimmed path gives the same behaviour across the long tail of engines the Angular/React ecosystem still targets.

The practical consequence is that **every host page must load `es-module-shims`** before `initFederation` runs. The native `import()` fallback inside `loadRemoteModule` exists for tests and SSR — it will happily resolve absolute URLs, but it won't honour the shimmed import map, so remote-originated bare specifiers will not resolve.

## Related

- [`remoteEntry.json` reference](../core/artifacts.md) — the shape the runtime reads.
- [`initFederation`](init-federation.md) — what actually drives the merge and injection.
- [Orchestrator](../orchestrator/index.md) — for range-based deduplication and share scopes.
