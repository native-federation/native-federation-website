---
applies_to: [v4]
---

# Build Artifacts

> The files Native Federation Core emits — remoteEntry.json, importmap.json and the federation cache layout.

After `federationBuilder.build()` finishes, the `outputPath` contains a handful of files that together form the contract between host, remote and runtime.

## Output Layout

```
dist/<project>/
├── remoteEntry.json        # metadata consumed by the runtime
├── importmap.json          # import map used to wire modules together
├── <exposes>.js            # one file per exposed module
├── <mapped-path>.js        # one file per shared tsconfig path
├── browser-shared-<hash>.js         # shared npm externals (browser)
├── node-shared-<hash>.js            # shared npm externals (node)
└── browser-<package>-<hash>.js      # packages built with build: 'package'
```

## `remoteEntry.json`

The remote's public manifest. Hosts fetch it when loading a remote:

```ts
interface FederationInfo {
  name: string;
  exposes: ExposesInfo[];
  shared: SharedInfo[];
  chunks?: Record<string, string[]>;
  integrity?: Record<string, string>;
  buildNotificationsEndpoint?: string;
}

interface ExposesInfo {
  key: string; // e.g. './component'
  outFileName: string; // path relative to remoteEntry.json
  element?: string; // custom-element tag name, when set on the exposes entry
  dev?: { entryPoint: string };
}

type SharedInfo = {
  packageName: string;
  requiredVersion: string;
  version?: string;
  singleton: boolean;
  strictVersion: boolean;
  outFileName: string;
  bundle?: string; // present when denseChunking is enabled
  shareScope?: string;
  pool?: string; // orchestrator resource-pool hint (since v4.3)
  dev?: { entryPoint: string };
};
```

### Example

```json
{
  "name": "mfe1",
  "exposes": [{ "key": "./component", "outFileName": "component-Q4XS7K1T.js" }],
  "shared": [
    {
      "packageName": "@angular/core",
      "requiredVersion": "^18.0.0",
      "version": "18.1.2",
      "singleton": true,
      "strictVersion": true,
      "outFileName": "angular-core-VFK9A2LE.js"
    }
  ]
}
```

## `importmap.json`

A standards-compliant [import map](https://html.spec.whatwg.org/multipage/webappapis.html#import-maps) built from every shared external. The runtime merges import maps from host and remotes at startup and injects the result into the page.

## Chunks and internal splits

With code-splitting enabled (the default), the bundler may split a shared package into multiple files — a primary entry plus one or more chunks. In classic mode, each chunk appears in `remoteEntry.json`'s `shared` array with a synthetic package name of the form `@nf-internal/chunk-XXXX`:

```json
{
  "packageName": "@nf-internal/chunk-IXOA6WTM",
  "outFileName": "chunk-IXOA6WTM.js",
  "singleton": false,
  "strictVersion": false,
  "version": "0.0.0",
  "requiredVersion": "0.0.0"
}
```

Version and singleton fields are placeholders — a chunk isn't versioned on its own; a content hash in its filename keeps it unique across builds.

When `features.denseChunking` is enabled, chunks move off the `shared` array and onto a dedicated `chunks` object:

```json
{
  "shared": [
    {
      "packageName": "@angular/core",
      "bundle": "browser-shared",
      "outFileName": "..."
    }
  ],
  "chunks": {
    "browser-shared": ["chunk-AB12.js", "chunk-CD34.js"]
  }
}
```

Each shared entry gets a `bundle` property pointing at its chunk bundle by name. The result is a smaller, more cache-friendly `remoteEntry.json` — and the runtime can skip entire chunk groups whose dependencies aren't part of the final import map.

## Dense Externals

When `features.denseExternals` is enabled (opt-in since v4.3), the `shared` array groups all entrypoints of a package — its primary import plus every secondary and shared mapping — under a single object. Instead of the flat `SharedInfo` shape (one entry per entrypoint, each with its own `outFileName`), each package becomes a `DenseSharedInfo`:

```ts
type DenseSharedInfo = Omit<SharedInfo, "outFileName"> & {
  entries: Record<string, string>; // import name → output file
};
```

```json
{
  "shared": [
    {
      "packageName": "@angular/common",
      "requiredVersion": "^22.0.0",
      "version": "20.0.6",
      "singleton": true,
      "strictVersion": true,
      "entries": {
        "@angular/common": "angular-common-VFK9A2LE.js",
        "@angular/common/http": "angular-common-http-Q4XS7K1T.js"
      }
    }
  ]
}
```

Entrypoints whose sharing metadata (`singleton`, `strictVersion`, `requiredVersion`, `version`, `shareScope`) diverges are split into separate groups. Bundler chunks stay flat and `importmap.json` is unaffected. The format is opt-in and fully backward compatible: the runtime detects each entry by shape (`entries` map vs. `outFileName`), so both classic and dense `remoteEntry.json` load. `denseExternals` and `denseChunking` are orthogonal and can be combined.

## Integrity map

When `features.integrityHashes` is enabled in `federation.config.js`, the core hashes every emitted shared external, exposed module and chunk and writes the digests under a top-level `integrity` map keyed by `outFileName`:

```json
{
  "name": "mfe1",
  "shared": [
    /* … */
  ],
  "exposes": [
    /* … */
  ],
  "integrity": {
    "angular-core-VFK9A2LE.js": "sha384-…",
    "component-Q4XS7K1T.js": "sha384-…",
    "chunk-IXOA6WTM.js": "sha384-…"
  }
}
```

The orchestrator resolves each entry to an absolute URL and emits it under the `integrity` block of the import map it injects, so the browser (or `es-module-shims`) can verify each module's bytes before executing it. See [Subresource Integrity](../orchestrator/security.md#subresource-integrity) for the end-to-end trust chain.

## Federation Cache

The in-memory counterpart to the on-disk cache is a `FederationCache`, passed through the whole build pipeline:

```ts
type FederationCache<TBundlerCache = unknown> = {
  externals: SharedInfo[];
  chunks?: Record<string, string[]>;
  integrity?: Record<string, string>;
  bundlerCache: TBundlerCache;
  cachePath: string;
};
```

Construct one with `createFederationCache(path)` when you need full control over the lifecycle. Adapters use the `bundlerCache` slot to thread their own state (esbuild `context`, compile graphs, …) across rebuilds. For the checksum, the on-disk layout and how cache hits are decided, see [Caching](caching.md).
