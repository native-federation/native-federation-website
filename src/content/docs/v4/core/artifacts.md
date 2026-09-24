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
  $version?: string; // manifest format marker
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
  pool?: string; // orchestrator resource-pool hint
  dev?: { entryPoint: string };
};
```

### Example

```json
{
  "$version": "v4",
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

### The `$version` marker

Every `remoteEntry.json` is written with `$version: "v4"` as its first key. It identifies the manifest format so a consumer — the orchestrator, a tool reading manifests, a future major — can branch on the format it was handed instead of inferring it from which fields happen to be present.

It is purely informational: v4 runtimes ignore it, and a manifest without the key stays valid.

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

Version and singleton fields are placeholders — a chunk isn't versioned on its own. It belongs to a build, not to a dependency, so it is never shared between applications: each remote loads its own copy.

The core names every chunk after a hash of the bytes it serves, replacing the hash the bundler chose. Identical chunks therefore share one name across rebuilds, and a changed chunk always gets a new one. The hash keeps the length of the bundler's hash, so every reference keeps its byte length and the emitted source maps stay valid. It is written in upper-case base32, because names differing only in case would collapse to one file on a case-insensitive filesystem.

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
    "browser-shared": ["chunk-AB23CD45.js", "chunk-EF67GH23.js"],
    "mapping-bundle": ["chunk-JK23LM45.js"],
    "mapping-or-exposed": ["chunk-NP67QR23.js"]
  }
}
```

Each shared entry gets a `bundle` property pointing at its chunk bundle by name. Shared mappings build apart from the exposed modules, so their chunks list under their own bundle (`mapping-bundle`, or `mapping-<name>` for a mapping with [`build`](configuration.md#mapping-bundles) set), and each mapping carries that bundle's name. The result is a smaller, more cache-friendly `remoteEntry.json` — and the runtime can skip entire chunk groups whose dependencies aren't part of the final import map.

## Dense Externals

When `features.denseExternals` is enabled (opt-in), the `shared` array groups all entrypoints of a package — its primary import plus every secondary and shared mapping — under a single object. Instead of the flat `SharedInfo` shape (one entry per entrypoint, each with its own `outFileName`), each package becomes a `DenseSharedInfo`:

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

Entrypoints are grouped only when all their metadata matches — everything except the output file and the `dev` hint, so `pool` and `bundle` included. Entrypoints that diverge are split into separate groups. `importmap.json` is unaffected.

The array is **uniformly dense**: bundler chunks use the same shape, so a consumer only ever handles one entry shape. A chunk is never grouped with anything else — it becomes its own object with a single-key `entries` map:

```json
{
  "packageName": "@nf-internal/chunk-IXOA6WTM",
  "singleton": false,
  "strictVersion": false,
  "version": "0.0.0",
  "requiredVersion": "0.0.0",
  "entries": { "@nf-internal/chunk-IXOA6WTM": "chunk-IXOA6WTM.js" }
}
```

The format is opt-in and fully backward compatible: the runtime detects each entry by shape (`entries` map vs. `outFileName`), so both classic and dense `remoteEntry.json` load. `denseExternals` and `denseChunking` are orthogonal and can be combined — with `denseChunking` on, chunks leave the `shared` array entirely and this conversion never applies to them.

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
